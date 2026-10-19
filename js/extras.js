// Canciones de las ediciones físicas (CD) que no están en la versión digital de iTunes:
// demos, pistas ocultas y bonus. Revisado a mano contra MusicBrainz en octubre de 2026.
// Suenan desde YouTube buscando por su nombre. [título, duración en segundos]
// Si se cambia algo aquí, sube EXTRAS_VERSION para que se vuelva a aplicar en las tablets.
export const EXTRAS_VERSION = 2;

export const EXTRAS = [
  {
    album: 'Proof', after: 'Dimple', // CD3, antes de "For Youth"
    tracks: [
      ['Jump (Demo Ver.)', 146], ['Young Love', 158], ['Boy In Luv (Demo Ver.)', 219], ['Quotation Mark', 179],
      ['I NEED U (Demo Ver.)', 162], ['Boyz with Fun (Demo Ver.)', 248], ['Tony Montana (with Jimin)', 200],
      ['Young Forever (RM Demo Ver.)', 137], ['Spring Day (V Demo Ver.)', 133], ['DNA (j-hope Demo Ver.)', 111],
      ['Epiphany (Jin Demo Ver.)', 226], ['Seesaw (Demo Ver.)', 189], ['Still With You (Acapella)', 240],
    ],
  },
  {
    album: "LOVE YOURSELF 承 'Her'", after: 'Outro: Her', // pistas ocultas
    tracks: [['Skit: Hesitation and Fear', 540], ['Sea', 312]],
  },
  {
    album: '2 Cool 4 Skool', after: 'Outro: Circle Room Cypher', // pistas ocultas
    tracks: [['Skit: On The Start Line', 153], ['Path', 228]],
  },
  {
    album: 'ARIRANG', after: 'Into the Sun',
    tracks: [['ARMYRANG', 37], ['ARMYRANG²', 39]],
  },
  {
    album: 'KEEP SWIMMING', after: null, // iTunes no publica su lista
    tracks: [
      ['SWIM', 159], ['SWIM with RM (Chill Hip Hop Remix)', 163], ['SWIM with Jin (Alternative Rock Remix)', 194],
      ['SWIM with SUGA (Melodic Techno Remix)', 220], ['SWIM with j-hope (Afrobeat Remix)', 153],
      ['SWIM with Jimin (Slow Jam R&B Remix)', 149], ['SWIM with V (Electronic Remix)', 141],
      ['SWIM with Jung Kook (Acoustic Lofi Remix)', 158], ['SWIM (Instrumental)', 158],
    ],
  },
];
