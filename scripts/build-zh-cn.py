#!/usr/bin/env python3
import argparse
import hashlib
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parent.parent
OFFICIAL_SHA256 = "53be1828d32386b95b089c82ec7b13e7375fa3989435af67b59c80ecd41ab7bc"
BUNDLE_ID = "com.kourivar.ardia.zhCN"
MACHO_MAGIC = {b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xfe\xed\xfa\xce", b"\xca\xfe\xba\xbe", b"\xbe\xba\xfe\xca"}


def run(*args, **kwargs):
    return subprocess.run([str(arg) for arg in args], check=True, **kwargs)


def entitlements(path):
    result = subprocess.run(["codesign", "-d", "--entitlements", "-", "--xml", str(path)], capture_output=True)
    start = result.stdout.find(b"<?xml")
    if start < 0:
        return {}
    return plistlib.loads(result.stdout[start:])


def signed_options(path):
    import re
    result = subprocess.run(["codesign", "-dv", str(path)], capture_output=True, text=True)
    match = re.search(r"flags=0x[0-9a-f]+\(([^)]+)\)", result.stderr)
    return [value for value in (match.group(1).split(",") if match else []) if value not in {"adhoc", "none"}]


def sign(path, identity, temporary, replacement=None):
    rights = entitlements(path) if replacement is None else replacement
    options = signed_options(path)
    if replacement is not None and not options:
        options = ["runtime"]
    args = ["codesign", "--force", "--sign", identity, "--timestamp=none"]
    if options:
        args += ["--options", ",".join(options)]
    if rights:
        rights_path = temporary / "signing.entitlements"
        rights_path.write_bytes(plistlib.dumps(rights))
        args += ["--entitlements", str(rights_path)]
    run(*args, path)


def main():
    parser = argparse.ArgumentParser(description="Build the Simplified Chinese JS UI against the verified official Ardia 0.2.39 macOS release and sign an independent app.")
    parser.add_argument("--official-zip", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--identity", required=True)
    args = parser.parse_args()
    if hashlib.sha256(args.official_zip.read_bytes()).hexdigest() != OFFICIAL_SHA256:
        raise SystemExit("Official release SHA256 does not match Ardia 0.2.39.")
    output = args.output.resolve()
    if output.exists():
        raise SystemExit("Output directory already exists; choose a new directory.")
    output.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix="ardia-zh-build-") as work:
        temporary = Path(work)
        run("ditto", "-x", "-k", args.official_zip.resolve(), temporary / "official")
        bases = list((temporary / "official").glob("*.app"))
        if len(bases) != 1:
            raise SystemExit("Expected one official app bundle.")
        app = output / "Ardia 中文版.app"
        run("ditto", bases[0], app)
        for profile in app.rglob("embedded.provisionprofile"):
            profile.unlink()
        resources = app / "Contents/Resources"
        (resources / "汉化说明.txt").write_text((ROOT / "LOCALIZATION.zh-CN.md").read_text())
        bundle = temporary / "main.jsbundle.js"
        run("pnpm", "exec", "react-native", "bundle", "--platform", "macos", "--dev", "false", "--entry-file", "index.js", "--max-workers", "4", "--bundle-output", bundle, "--assets-dest", resources, cwd=ROOT / "apps/browser")
        compiler = ROOT / "node_modules/react-native/sdks/hermesc/osx-bin/hermesc"
        run(compiler, "-O", "-emit-binary", "-out", resources / "main.jsbundle", bundle)
        info_path = app / "Contents/Info.plist"
        info = plistlib.loads(info_path.read_bytes())
        if info["CFBundleShortVersionString"] != "0.2.39":
            raise SystemExit("Unexpected official version.")
        info.update(CFBundleIdentifier=BUNDLE_ID, CFBundleName="Ardia 中文版", CFBundleDisplayName="Ardia 中文版", CFBundleExecutable="ArdiaZhLauncher", CFBundleDevelopmentRegion="zh_CN", CFBundleLocalizations=["zh-Hans", "en"], SUAutomaticallyUpdate=False, SUEnableAutomaticChecks=False)
        for key in ["SUFeedURL", "SUPublicEDKey"]:
            info.pop(key, None)
        descriptions = {
            "NSAppleEventsUsageDescription": "导入时，Ardia 会读取 Dia 的个人资料、已打开标签页和固定标签页，不会修改 Dia 的数据。",
            "NSBluetoothAlwaysUsageDescription": "使用手机上的通行密钥登录需要蓝牙，网站也可能请求使用蓝牙设备。",
            "NSCalendarsFullAccessUsageDescription": "Ardia 在固定的日历标签页中显示即将开始的会议、提前提醒，并整理通话期间打开的标签页。",
            "NSCameraUsageDescription": "网站可能请求使用你的摄像头。",
            "NSLocalNetworkUsageDescription": "Ardia 查找局域网中的投屏设备，以便投放标签页。",
            "NSLocationUsageDescription": "网站可能请求使用你的位置信息。",
            "NSLocationWhenInUseUsageDescription": "网站可能请求使用你的位置信息。",
            "NSMicrophoneUsageDescription": "网站可能请求使用你的麦克风。",
        }
        info.update(descriptions)
        info_path.write_bytes(plistlib.dumps(info))
        locale = resources / "zh-Hans.lproj"
        locale.mkdir(exist_ok=True)
        (locale / "InfoPlist.strings").write_bytes(plistlib.dumps(descriptions | {"CFBundleDisplayName": "Ardia 中文版"}))
        native = app / "Contents/MacOS/Ardia"
        root_rights = entitlements(native)
        for key in ["com.apple.application-identifier", "com.apple.developer.team-identifier", "keychain-access-groups"]:
            root_rights.pop(key, None)
        launcher = app / "Contents/MacOS/ArdiaZhLauncher"
        run("clang", "-arch", "arm64", "-mmacosx-version-min=14.0", "-fobjc-arc", "-framework", "Foundation", ROOT / "scripts/zh-cn-launcher.m", "-o", launcher)
        code = []
        bundles = []
        for folder, dirs, files in os.walk(app, followlinks=False):
            dirs[:] = [name for name in dirs if not (Path(folder) / name).is_symlink()]
            parent = Path(folder)
            if parent != app and parent.suffix in {".app", ".framework", ".xpc", ".plugin"}:
                bundles.append(parent)
            for filename in files:
                path = parent / filename
                if path.is_symlink():
                    continue
                with path.open("rb") as handle:
                    if handle.read(4) in MACHO_MAGIC:
                        code.append(path)
        for path in sorted(set(code + bundles), key=lambda value: (len(value.parts), len(str(value))), reverse=True):
            sign(path, args.identity, temporary, root_rights if path in {native, launcher} else None)
        sign(app, args.identity, temporary, root_rights)
        run("codesign", "--verify", "--deep", "--strict", "--verbose=2", app)
        archive = output / "Ardia-0.2.39-zh-CN.zip"
        run("ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", app, archive)
        (output / "SHA256SUMS.txt").write_text(f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n")
        print(app)
        print(archive)


if __name__ == "__main__":
    main()
