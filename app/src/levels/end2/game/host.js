// App port: what the running game instance owns. createAscent() fills it before building anything, so the modules
// that used to append to document.body or listen on window (flight, flight-hud, audio) attach to the game's root
// and register through its on(), and dispose() takes them all down. One ASCENT runs at a time.
export const host = {
  el: null,
  on: (target, type, fn, o) => target.addEventListener(type, fn, o),
};
