import React, { useState } from 'react';

export function AppearanceSettings() {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const style = getComputedStyle(document.documentElement);
  const primaryColor = style.getPropertyValue('--primary').trim();

  const hexToHsl = (hex: string) => {
    hex = hex.replace('#', '');

    const bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    let h, s, l;
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h! /= 6;
    }

    return `${Math.round(h! * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedColor(event.target.value);
    const hslColor = hexToHsl(event.target.value);
    document.documentElement.style.setProperty('--primary', hslColor);
  };

  return (
    <div>
      <h1 className="title">Appearance</h1>

      <h2 className='pt-4'>Primary Color</h2>
      <input type="color" value={selectedColor || primaryColor} onChange={handleChange} />
      <p>Selected color: {selectedColor || primaryColor}</p>
    </div>
  );
}
