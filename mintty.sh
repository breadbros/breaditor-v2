#!/usr/bin/bash

if which mintty >/dev/null; then
    echo "mintty exists!"
    mintty --size 160,40 -e bash -c "touch .out && cat .out && tail -f .out" 
    mintty --size 160,40 -e bash -c "touch .err && cat .err && tail -f .err" 
else
    echo "mintty does not exist :("
    echo "we will not autotail your logs"
fi

: "
---------------------------
mintty
---------------------------
Usage: mintty [OPTION]... [ PROGRAM [ARG]... | - ]

Start a new terminal session running the specified program or the user's shell.
If a dash is given instead of a program, invoke the shell as a login shell.

Options:
  -c, --config FILE     Load specified config file (cf. -C or -o ThemeFile)
  -e, --exec ...        Treat remaining arguments as the command to execute
  -h, --hold never|start|error|always  Keep window open after command finishes
  -p, --position X,Y    Open window at specified coordinates
  -p, --position center|left|right|top|bottom  Open window at special position
  -p, --position @N     Open window on monitor N
  -s, --size COLS,ROWS  Set screen size in characters (also COLSxROWS)
  -s, --size maxwidth|maxheight  Set max screen size in given dimension
  -t, --title TITLE     Set window title (default: the invoked command) (cf. -T)
  -w, --window normal|min|max|full|hide  Set initial window state
  -i, --icon FILE[,IX]  Load window icon from file, optionally with index
  -l, --log FILE|-      Log output to file or stdout
      --nobidi|--nortl  Disable bidi (right-to-left support)
  -o, --option OPT=VAL  Set/Override config file option with given value
  -B, --Border frame|void  Use thin/no window border
  -R, --Report s|o      Report window position (short/long) after exit
      --nopin           Make this instance not pinnable to taskbar
  -D, --daemon          Start new instance with Windows shortcut key
  -H, --help            Display help and exit
  -V, --version         Print version information and exit
See manual page for further command line options and configuration.
"