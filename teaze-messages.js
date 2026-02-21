/**
 * Message library for Send A Teaze.
 * 8 buckets (4 moments × 2 styles), 12 messages each = 96 messages.
 * Bucket key: moment:style (e.g. START:PLAYFUL)
 * Tone: confident-kind, short, no manipulation/ultimatums/humiliation.
 * PLAYFUL: max 1 emoji. CLASSY: 0 emoji preferred.
 */
(function(global) {
  'use strict';

  const TEAZE_MESSAGES = {
    'START:PLAYFUL': [
      { id: 0, text: 'I couldn\'t stop thinking about you today.' },
      { id: 1, text: 'You crossed my mind. Again.' },
      { id: 2, text: 'Wanted to say hey before the day gets away from me.' },
      { id: 3, text: 'You\'ve been on my mind. How\'s your day going?' },
      { id: 4, text: 'Felt like reaching out. Hope you\'re doing well.' },
      { id: 5, text: 'Couldn\'t resist saying hi.' },
      { id: 6, text: 'Been meaning to text you. Here I am.' },
      { id: 7, text: 'You popped into my head. Wanted you to know.' },
      { id: 8, text: 'Hi. You\'ve occupied my thoughts today.' },
      { id: 9, text: 'Reaching out because why not? Hope your day\'s good.' },
      { id: 10, text: 'I\'ve been thinking about you. That\'s all.' },
      { id: 11, text: 'Sending you a little hello.' }
    ],
    'START:CLASSY': [
      { id: 0, text: 'I hope this finds you well.' },
      { id: 1, text: 'Thinking of you today.' },
      { id: 2, text: 'Wanted to reach out.' },
      { id: 3, text: 'I hope your day is treating you kindly.' },
      { id: 4, text: 'A quick hello from my corner of the world.' },
      { id: 5, text: 'I\'ve been meaning to say hello.' },
      { id: 6, text: 'Wishing you a lovely day.' },
      { id: 7, text: 'I hope we can connect soon.' },
      { id: 8, text: 'Sending warm thoughts your way.' },
      { id: 9, text: 'A brief note to say I\'m thinking of you.' },
      { id: 10, text: 'I trust all is well on your end.' },
      { id: 11, text: 'Hello. I hope this message brings a smile.' }
    ],
    'KEEP_GOING:PLAYFUL': [
      { id: 0, text: 'This is fun. Don\'t stop now.' },
      { id: 1, text: 'You keep me on my toes and I love it.' },
      { id: 2, text: 'The tension is delicious. I\'m here for it.' },
      { id: 3, text: 'You\'re good at this. Keep going.' },
      { id: 4, text: 'I like where this is heading.' },
      { id: 5, text: 'Your wit matches mine. Rare.' },
      { id: 6, text: 'We\'re just getting started.' },
      { id: 7, text: 'The anticipation is half the fun.' },
      { id: 8, text: 'You know exactly what you\'re doing.' },
      { id: 9, text: 'Keep me guessing. I don\'t mind.' },
      { id: 10, text: 'This back and forth? I\'m enjoying it.' },
      { id: 11, text: 'We\'re building something here.' }
    ],
    'KEEP_GOING:CLASSY': [
      { id: 0, text: 'I\'m enjoying our conversation.' },
      { id: 1, text: 'You have a way with words.' },
      { id: 2, text: 'I hope we continue this.' },
      { id: 3, text: 'Your energy matches mine.' },
      { id: 4, text: 'I appreciate how you keep things interesting.' },
      { id: 5, text: 'There\'s a nice rhythm to our exchange.' },
      { id: 6, text: 'I\'d like to see where this leads.' },
      { id: 7, text: 'You intrigue me.' },
      { id: 8, text: 'Our connection feels natural.' },
      { id: 9, text: 'I hope we keep talking.' },
      { id: 10, text: 'You make conversation easy.' },
      { id: 11, text: 'I\'m glad we\'re still in touch.' }
    ],
    'RECONNECT:PLAYFUL': [
      { id: 0, text: 'Hey stranger. It\'s been a minute.' },
      { id: 1, text: 'Life got busy but you\'re still on my mind.' },
      { id: 2, text: 'Miss our chats. Can we pick up where we left off?' },
      { id: 3, text: 'I know it\'s been a while. No excuses — just hi.' },
      { id: 4, text: 'You crossed my mind today. Wanted to say hey.' },
      { id: 5, text: 'Been too long. How\'ve you been?' },
      { id: 6, text: 'I dropped the ball. Still here though.' },
      { id: 7, text: 'Reappearing like a good plot twist.' },
      { id: 8, text: 'Can we pretend we never drifted? Hi again.' },
      { id: 9, text: 'I owe you a proper catch-up.' },
      { id: 10, text: 'You\'re still someone I want to talk to.' },
      { id: 11, text: 'Let\'s not let this fade.' }
    ],
    'RECONNECT:CLASSY': [
      { id: 0, text: 'I\'ve been meaning to reach out.' },
      { id: 1, text: 'It\'s been too long. I hope you\'re well.' },
      { id: 2, text: 'I\'d like to reconnect.' },
      { id: 3, text: 'Time got away from me. You\'re still important.' },
      { id: 4, text: 'I hope we can pick up where we left off.' },
      { id: 5, text: 'Life has been full, but I haven\'t forgotten you.' },
      { id: 6, text: 'I\'d love to hear how you\'ve been.' },
      { id: 7, text: 'Sending a note to say I\'m still here.' },
      { id: 8, text: 'I treasure our connection. Let\'s not lose it.' },
      { id: 9, text: 'I hope this finds you open to reconnecting.' },
      { id: 10, text: 'You crossed my mind. Wanted you to know.' },
      { id: 11, text: 'I\'d like to close the gap between us.' }
    ],
    'CLOSE_KINDLY:PLAYFUL': [
      { id: 0, text: 'You\'re great, but I\'m not in the right place for this.' },
      { id: 1, text: 'I need to bow out gracefully. No hard feelings.' },
      { id: 2, text: 'This was fun while it lasted. Take care.' },
      { id: 3, text: 'I\'m stepping back, but I wish you well.' },
      { id: 4, text: 'You deserve someone more available. That\'s not me right now.' },
      { id: 5, text: 'I\'m going to pull back. No drama — just honesty.' },
      { id: 6, text: 'I need to be upfront: I\'m not able to give this what it deserves.' },
      { id: 7, text: 'I\'ve enjoyed this, but I need to step away.' },
      { id: 8, text: 'Taking a breather. You\'re lovely — that hasn\'t changed.' },
      { id: 9, text: 'I\'m not the right fit right now. Wishing you the best.' },
      { id: 10, text: 'Gotta go, but on good terms. Take care.' },
      { id: 11, text: 'I respect you too much to string you along. Be well.' }
    ],
    'CLOSE_KINDLY:CLASSY': [
      { id: 0, text: 'I need to be honest with you.' },
      { id: 1, text: 'I\'ve enjoyed our time, but I must step back.' },
      { id: 2, text: 'I wish you nothing but the best.' },
      { id: 3, text: 'I\'m not in a place to continue this. I hope you understand.' },
      { id: 4, text: 'I value your time too much to waste it.' },
      { id: 5, text: 'I\'m choosing to end things kindly.' },
      { id: 6, text: 'You deserve clarity. I\'m not able to offer more.' },
      { id: 7, text: 'I hope we part on good terms.' },
      { id: 8, text: 'I\'ve appreciated our connection. I wish you well.' },
      { id: 9, text: 'I\'m stepping away with respect for you.' },
      { id: 10, text: 'Thank you for your time. I wish you happiness.' },
      { id: 11, text: 'I trust you\'ll understand. Take care.' }
    ]
  };

  global.TEAZE_MESSAGES = TEAZE_MESSAGES;
})(typeof window !== 'undefined' ? window : this);
