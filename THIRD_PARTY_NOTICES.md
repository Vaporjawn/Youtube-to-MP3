# Third-party software

YouTube To MP3 is released under the MIT License (see LICENSE.md). It starts the following separate programs
to do its work. They ship unmodified next to the app, in the `bin` folder of its resources.

## yt-dlp

Finds the video and downloads its audio.

-   Version: 2026.08.19 (the app can update its own copy; see "Check for yt-dlp Updates" in the Preferences menu)
-   License: The Unlicense (public domain)
-   Source: https://github.com/yt-dlp/yt-dlp

## FFmpeg

Converts the downloaded audio to MP3 (using the LAME encoder).

-   Version: 9.0.2
-   License: GNU General Public License v3 or later. These are GPL builds, not nonfree ones.
-   Builds used:
    -   macOS and Linux: https://ffmpeg.martin-riedl.de (build scripts: https://gitlab.com/martinr92/ffmpeg)
    -   Windows: https://www.gyan.dev/ffmpeg/builds/ ("essentials" build, GitHub mirror https://github.com/GyanD/codexffmpeg)
-   Source code for FFmpeg 9.0.2: https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
-   FFmpeg is a separate program that this app runs as a child process. It is not linked into the app.
    You can replace the `ffmpeg` file in the `bin` folder with any build of your own.
-   FFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.

## Electron and Chromium

The application shell. The Electron license is in `LICENSE.electron.txt` and the licenses of everything
inside Chromium are in `LICENSES.chromium.html`, both next to the app executable.

## React

Used to draw the window. MIT License. https://github.com/facebook/react
