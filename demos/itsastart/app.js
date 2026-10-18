/* It's a Start: the final design from the Google x BrainStation hackathon,
   wired as a click-through from sign in to joining a live support group. */
Proto.init({
  name: "It's a Start", kind: 'Mobile prototype · Google Hackathon', ratio: 799 / 1600,
  blurb: 'Helps people find support groups and build connections. Sign in, accept the check-in prompt, pick a community, and join a live session.',
  hint: 'Tap the buttons on the phone. Tapping anywhere else highlights what you can press.',
  start: 'welcome',
  order: ['welcome', 'prompt', 'home', 'group', 'live'],
  screens: {
    welcome: { label: 'Sign in', img: 'screens/welcome.webp', hot: [
      { x: 19, y: 49.2, w: 61, h: 5.4, to: 'prompt', label: 'Log in', toast: 'Signed in' },
      { x: 19, y: 56.9, w: 61, h: 5.4, to: 'prompt', label: 'Sign up', toast: 'Account created' },
      { x: 50, y: 90, w: 36, h: 4.5, to: 'prompt', label: 'Continue as guest' } ] },
    prompt: { label: 'Check-in', img: 'screens/prompt.webp', hot: [
      { x: 24, y: 66.5, w: 30, h: 6, to: 'home', label: "Let's talk" },
      { x: 62, y: 3, w: 36, h: 94, to: 'home', label: 'Dismiss' } ] },
    home: { label: 'Communities', img: 'screens/home.webp', hot: [
      { x: 15, y: 60, w: 28, h: 6, to: 'group', label: 'Join Veterans Support Group' },
      { x: 62, y: 60, w: 28, h: 6, to: 'group', label: 'Join Anxiety and Depression', toast: 'Showing Veterans Support Group in this demo' },
      { x: 13, y: 27, w: 34, h: 23, to: 'group', label: 'Open Veterans Support Group' } ] },
    group: { label: 'Support group', img: 'screens/group.webp', hot: [
      { x: 67, y: 57.5, w: 21, h: 5.5, to: 'live', label: 'Join now' },
      { x: 5, y: 6, w: 11, h: 5.5, to: 'home', label: 'Menu' } ] },
    live: { label: 'Live session', img: 'screens/live.webp', hot: [
      { x: 6, y: 6, w: 10, h: 5, to: 'back', label: 'Back' },
      { x: 18, y: 47, w: 31, h: 6, to: 'live', label: 'Raise hand', toast: 'Hand raised. The host will invite you to speak.' } ] }
  }
});
