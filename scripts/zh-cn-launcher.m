#import <Foundation/Foundation.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
  @autoreleasepool {
    NSBundle *bundle = NSBundle.mainBundle;
    if (![bundle.bundleIdentifier isEqualToString:@"com.kourivar.ardia.zhCN"]) return 78;
    const char *dataDirectory = getenv("ARDIA_DATA_DIR");
    if (!dataDirectory || !*dataDirectory) {
      NSURL *support = [NSURL fileURLWithPath:[NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/com.kourivar.ardia.zhCN"] isDirectory:YES];
      NSError *error = nil;
      if (![NSFileManager.defaultManager createDirectoryAtURL:support withIntermediateDirectories:YES attributes:nil error:&error]) {
        NSLog(@"Unable to initialize Ardia Chinese data directory: %@", error);
        return 78;
      }
      NSURL *marker = [support URLByAppendingPathComponent:@".legacy-migration.json"];
      int descriptor = open(marker.fileSystemRepresentation, O_WRONLY | O_CREAT | O_EXCL, 0600);
      if (descriptor >= 0) {
        const char *data = "{\"version\":1,\"phase\":\"done\",\"outcome\":\"fresh\",\"defaultBrowser\":\"unchanged\"}";
        size_t size = strlen(data);
        BOOL valid = write(descriptor, data, size) == (ssize_t)size;
        valid = fsync(descriptor) == 0 && valid;
        valid = close(descriptor) == 0 && valid;
        if (!valid) {
          unlink(marker.fileSystemRepresentation);
          return 78;
        }
      } else if (errno != EEXIST) {
        perror("Ardia Chinese migration marker");
        return 78;
      }
      NSData *saved = [NSData dataWithContentsOfURL:marker];
      id journal = saved ? [NSJSONSerialization JSONObjectWithData:saved options:0 error:nil] : nil;
      if (![journal isKindOfClass:NSDictionary.class] || ![journal[@"version"] isEqual:@1] || ![journal[@"phase"] isEqual:@"done"] || ![journal[@"outcome"] isEqual:@"fresh"] || ![journal[@"defaultBrowser"] isEqual:@"unchanged"]) {
        NSLog(@"Ardia Chinese migration marker is incomplete or invalid.");
        return 78;
      }
    }
    NSString *nativePath = [bundle.bundlePath stringByAppendingPathComponent:@"Contents/MacOS/Ardia"];
    argv[0] = (char *)nativePath.fileSystemRepresentation;
    execv(argv[0], argv);
    perror("Ardia Chinese launch");
    return 78;
  }
}
