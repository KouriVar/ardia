import { nativeModule, type ConfirmOptions, type PromptOptions } from "@ardia/shell";
import { currentT } from "../state/i18n";

const Dialogs = nativeModule("ArdiaDialogs");

const localize = <T extends ConfirmOptions | PromptOptions>(options: T): T => {
  const t = currentT();
  return {
    ...options,
    title: t(options.title),
    ...(options.message === undefined ? {} : { message: t(options.message) }),
    ...("confirmTitle" in options && options.confirmTitle !== undefined ? { confirmTitle: t(options.confirmTitle) } : {}),
    ...("cancelTitle" in options && options.cancelTitle !== undefined ? { cancelTitle: t(options.cancelTitle) } : {}),
    ...("placeholder" in options && options.placeholder !== undefined ? { placeholder: t(options.placeholder) } : {}),
    ...("suppression" in options && options.suppression !== undefined ? { suppression: t(options.suppression) } : {}),
  } as T;
};

export const confirm = (options: ConfirmOptions) => Dialogs.confirm(localize(options));
export const prompt = (options: PromptOptions) => Dialogs.prompt(localize(options));
export const pickFiles = () => Dialogs.pickFiles();
export const pickFolder = (current: string | null, prompt: string | null = null) => Dialogs.pickFolder(current, prompt);
