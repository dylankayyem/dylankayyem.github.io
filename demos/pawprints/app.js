/* PawPrints: the final iOS design from the BrainStation capstone, wired as a
   click-through. Tap targets sit over the real buttons in each screen. */
Proto.init({
  name: 'PawPrints', kind: 'iOS prototype · Figma final design', ratio: 540 / 1044,
  blurb: 'Find other dog owners nearby, match your dog with a friend, and drop a PlayMarker at a park so others can join. Sign in, match, then schedule a playdate.',
  hint: 'Tap the buttons on the phone. Tapping anywhere else highlights what you can press.',
  start: 'welcome',
  order: ['welcome', 'match', 'matched', 'map', 'verify', 'playmarkers'],
  screens: {
    welcome: { label: 'Sign in', img: 'screens/welcome.webp', hot: [
      { x: 13, y: 55.5, w: 74, h: 8.5, to: 'match', label: 'Register', toast: 'Account created' },
      { x: 13, y: 68.5, w: 74, h: 8.5, to: 'match', label: 'Sign in', toast: 'Signed in' },
      { x: 13, y: 81.5, w: 74, h: 8.5, to: 'match', label: 'Log in with Facebook', toast: 'Signed in with Facebook' } ] },
    match: { label: 'Match', img: 'screens/match.webp', hot: [
      { x: 12, y: 81.5, w: 36, h: 9.5, to: 'match', label: 'Pass', toast: 'Passed on Reggie · showing the next pup' },
      { x: 52, y: 81.5, w: 36, h: 9.5, to: 'matched', label: 'Like' },
      { x: 42, y: 6, w: 18, h: 6.5, to: 'map', label: 'PlayMarkers tab' },
      { x: 63, y: 6, w: 18, h: 6.5, to: 'match', label: 'Messages tab', toast: 'Messages are part of the next design phase' } ] },
    matched: { label: "It's a match", img: 'screens/matched.webp', hot: [
      { x: 12, y: 53.5, w: 76, h: 8.5, to: 'map', label: 'Set PlayMarker' },
      { x: 12, y: 66.5, w: 76, h: 8.5, to: 'matched', label: 'Send message', toast: 'Message sent to Dylan' },
      { x: 12, y: 79.5, w: 76, h: 8.5, to: 'match', label: 'Continue matching' } ] },
    map: { label: 'PlayMarker map', img: 'screens/map.webp', hot: [
      { x: 8, y: 16, w: 84, h: 55, to: 'verify', label: 'Choose a park on the map' },
      { x: 17, y: 6, w: 14, h: 6.5, to: 'match', label: 'Match tab' },
      { x: 8, y: 6, w: 8, h: 6.5, to: 'back', label: 'Back' } ] },
    verify: { label: 'Verify event', img: 'screens/verify.webp', hot: [
      { x: 13, y: 81, w: 74, h: 9, to: 'playmarkers', label: 'Complete', toast: 'PlayMarker created at Village of Five Parks' },
      { x: 9, y: 6.5, w: 8, h: 5.5, to: 'back', label: 'Back' } ] },
    playmarkers: { label: 'My PlayMarkers', img: 'screens/playmarkers.webp', hot: [
      { x: 13, y: 81, w: 74, h: 9, to: 'map', label: 'Create new' },
      { x: 17, y: 6, w: 14, h: 6.5, to: 'match', label: 'Match tab' },
      { x: 8, y: 6, w: 8, h: 6.5, to: 'back', label: 'Back' } ] }
  }
});
