// Discografía base. Las portadas son genéricas hasta que subas la imagen real desde "Editar".
export const VINYL_COLORS = [
  { name: 'Negro', value: '#121212' },
  { name: 'Morado', value: '#6a3fb0' },
  { name: 'Lavanda', value: '#b9a3e8' },
  { name: 'Rosa', value: '#e98ab0' },
  { name: 'Rojo', value: '#9e1424' },
  { name: 'Amarillo', value: '#f0c22e' },
  { name: 'Azul', value: '#2f5d9e' },
  { name: 'Cielo', value: '#8cc6e6' },
  { name: 'Blanco', value: '#e9e7e2' },
  { name: 'Dorado', value: '#b8913a' },
];

export const DEFAULT_ALBUMS = [
  { slug: '2cool4skool', title: '2 Cool 4 Skool', year: 2013, vinyl: '#121212', palette: { bg: ['#ece6da', '#b9b09f'], fg: '#1a1a1a', accent: '#c0392b', style: 'frame' } },
  { slug: 'orul82', title: 'O!RUL8,2?', year: 2013, vinyl: '#121212', palette: { bg: ['#2d2d2d', '#0d0d0d'], fg: '#f2f2f2', accent: '#d4af37', style: 'stripes' } },
  { slug: 'skool-luv-affair', title: 'Skool Luv Affair', year: 2014, vinyl: '#9e1424', palette: { bg: ['#f4f1ea', '#d9d2c3'], fg: '#141414', accent: '#e03a3a', style: 'circle' } },
  { slug: 'dark-and-wild', title: 'Dark & Wild', year: 2014, vinyl: '#121212', palette: { bg: ['#1d1d1d', '#000000'], fg: '#ffffff', accent: '#c81e1e', style: 'grain' } },
  { slug: 'hyyh-pt1', title: 'The Most Beautiful Moment in Life, Pt.1', year: 2015, vinyl: '#e98ab0', palette: { bg: ['#f7c6d4', '#ef94b0'], fg: '#ffffff', accent: '#ffffff', style: 'minimal' } },
  { slug: 'hyyh-pt2', title: 'The Most Beautiful Moment in Life, Pt.2', year: 2015, vinyl: '#8cc6e6', palette: { bg: ['#c4e3f4', '#86c1e3'], fg: '#ffffff', accent: '#ffffff', style: 'minimal' } },
  { slug: 'young-forever', title: 'The Most Beautiful Moment in Life: Young Forever', year: 2016, vinyl: '#e9e7e2', palette: { bg: ['#f6f6f6', '#d9d9d9'], fg: '#222222', accent: '#f2a1c0', style: 'dots' } },
  { slug: 'wings', title: 'Wings', year: 2016, vinyl: '#121212', palette: { bg: ['#262626', '#0b0b0b'], fg: '#e8e2d0', accent: '#b38b59', style: 'wings' } },
  { slug: 'ynwa', title: 'You Never Walk Alone', year: 2017, vinyl: '#e9e7e2', palette: { bg: ['#f0ece4', '#cbc3b4'], fg: '#1b1b1b', accent: '#3f6fb5', style: 'wings' } },
  { slug: 'ly-her', title: "Love Yourself 承 'Her'", year: 2017, vinyl: '#e98ab0', palette: { bg: ['#fdfdfd', '#e6e6ee'], fg: '#333333', accent: '#f4a6c8', style: 'flower' } },
  { slug: 'ly-tear', title: "Love Yourself 轉 'Tear'", year: 2018, vinyl: '#121212', palette: { bg: ['#5e5e63', '#26262a'], fg: '#f0f0f0', accent: '#9aa0a6', style: 'flower' } },
  { slug: 'ly-answer', title: "Love Yourself 結 'Answer'", year: 2018, vinyl: '#8cc6e6', palette: { bg: ['#ffffff', '#e8e8e8'], fg: '#222222', accent: '#7fc8e8', style: 'flower' } },
  { slug: 'mots-persona', title: 'Map of the Soul: Persona', year: 2019, vinyl: '#e98ab0', palette: { bg: ['#f7b9cf', '#e98aae'], fg: '#ffffff', accent: '#ffffff', style: 'grid' } },
  { slug: 'mots-7', title: 'Map of the Soul: 7', year: 2020, vinyl: '#121212', palette: { bg: ['#1c1c1c', '#000000'], fg: '#ffffff', accent: '#ffffff', style: 'grid' } },
  { slug: 'be', title: 'BE', year: 2020, vinyl: '#e9e7e2', palette: { bg: ['#f2f2f0', '#d4d4cf'], fg: '#1e1e1e', accent: '#8a8a8a', style: 'minimal' } },
  { slug: 'butter', title: 'Butter', year: 2021, vinyl: '#f0c22e', palette: { bg: ['#ffe27a', '#f2be12'], fg: '#3a2e00', accent: '#ffffff', style: 'circle' } },
  { slug: 'proof', title: 'Proof', year: 2022, vinyl: '#6a3fb0', palette: { bg: ['#141414', '#000000'], fg: '#ffffff', accent: '#a970ff', style: 'stripes' } },
  // itunesHint: edición exacta del catálogo de iTunes cuando hay varias con el mismo nombre
  { slug: 'arirang', title: 'ARIRANG', year: 2026, vinyl: '#121212', itunesHint: 1868481904, palette: { bg: ['#f4efe8', '#d8cfc2'], fg: '#1a1a1a', accent: '#b3122b', style: 'minimal' } },
];

const STYLES = ['minimal', 'circle', 'stripes', 'grid', 'dots', 'flower', 'frame', 'grain', 'wings'];
const PALS = [
  { bg: ['#b9a3e8', '#6a3fb0'], fg: '#ffffff', accent: '#ffffff' },
  { bg: ['#f7c6d4', '#e98aae'], fg: '#ffffff', accent: '#ffffff' },
  { bg: ['#262626', '#050505'], fg: '#ffffff', accent: '#a970ff' },
  { bg: ['#f4f1ea', '#d0c8b8'], fg: '#1a1a1a', accent: '#a970ff' },
];

export function newAlbumTemplate(order) {
  const p = PALS[Math.floor(Math.random() * PALS.length)];
  return {
    title: 'Nuevo álbum', artist: 'BTS', year: new Date().getFullYear(), vinyl: '#121212',
    palette: { ...p, style: STYLES[Math.floor(Math.random() * STYLES.length)] },
    order, tracks: [], cover: null,
  };
}
