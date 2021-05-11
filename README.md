# GTK Title Bar - Remove Title Bar for non-GTK Software

- This extension simply removes title bars on apps like Spotify and Qt5 apps when you maximize or tile them.
- Unlike Unite, this does not remove window buttons for GTK apps.
- Makes the minimal change on your system's default behaviour.
- Supports GNOME 3.28+ (40 included).

## Credits

- This work here is hardfork of the [unite-shell](https://github.com/hardpixel/unite-shell) extension. 

## Dependencies

- `xprop` should come preinstalled with your system. If not, you should install it.

## Screenshots
[<img src="ss_1.png">](ss_1.png)
[<img src="ss_2.png">](ss_2.png)
[<img src="ss_3.png" >](ss_3.png)

## Installation

### From https://extensions.gnome.org (Recommended)

1. Go to https://extensions.gnome.org/extension/1732/gtk-title-bar/
2. Install and Enable.

### From GitHub

1. Download the latest release from 'Releases' page.
2. Extract the folder into `~/.local/share/gnome-shell/extensions`.
3. 
   * For **X11**, do `Alt-F2` and  type `r` or `restart`. This will restart the GNOME Shell.
   * For **Wayland**, log out and log back in.
4. 
   * On **3.38 and above**, enable `GTK Title Bar` using the `Extensions` app.
   * On **below 3.38**, install `GNOME Tweak Tool` if not installed and enable `GTK Title Bar`.

### Arch

AUR VCS package available: https://aur.archlinux.org/packages/gnome-shell-extension-gtktitlebar-git/
