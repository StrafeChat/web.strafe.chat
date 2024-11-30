import { Component, createSignal, Show, onCleanup } from "solid-js";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  class?: string;
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const ColorPicker: Component<ColorPickerProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [hsv, setHsv] = createSignal<HSV>(hexToHsv(props.value));
  let pickerRef: HTMLDivElement | undefined;
  let saturationRef: HTMLDivElement | undefined;
  let hueRef: HTMLDivElement | undefined;
  let isDraggingSaturation = false;
  let isDraggingHue = false;

  function hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  function rgbToHsv(r: number, g: number, b: number): HSV {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, v: v * 100 };
  }

  function hexToHsv(hex: string): HSV {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsv(r, g, b);
  }

  function hsvToRgb(h: number, s: number, v: number): RGB {
    h /= 360;
    s /= 100;
    v /= 100;

    let r = 0,
      g = 0,
      b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
        break;
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  function hsvToHex(h: number, s: number, v: number): string {
    const rgb = hsvToRgb(h, s, v);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function handleSaturationMouseDown(e: MouseEvent) {
    isDraggingSaturation = true;
    handleSaturationMove(e);
  }

  function handleHueMouseDown(e: MouseEvent) {
    isDraggingHue = true;
    handleHueMove(e);
  }

  function handleMouseUp() {
    isDraggingSaturation = false;
    isDraggingHue = false;
  }

  function handleSaturationMove(e: MouseEvent) {
    if (!isDraggingSaturation || !saturationRef) return;

    const rect = saturationRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const newHsv = {
      ...hsv(),
      s: x * 100,
      v: (1 - y) * 100,
    };
    setHsv(newHsv);
    props.onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
  }

  function handleHueMove(e: MouseEvent) {
    if (!isDraggingHue || !hueRef) return;

    const rect = hueRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const newHsv = {
      ...hsv(),
      h: x * 360,
    };
    setHsv(newHsv);
    props.onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
  }

  function handleMouseMove(e: MouseEvent) {
    handleSaturationMove(e);
    handleHueMove(e);
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (pickerRef && !pickerRef.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  });

  return (
    <div ref={pickerRef} class={`relative ${props.class || ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        class="w-10 h-10 rounded border border-border"
        style={{ "background-color": props.value }}
      />

      <Show when={isOpen()}>
        <div class="absolute top-full left-0 mt-2 p-4 bg-surface border border-border rounded-lg shadow-lg z-50">
          <div
            ref={saturationRef}
            class="w-56 h-40 relative cursor-crosshair rounded overflow-hidden mb-2"
            onMouseDown={handleSaturationMouseDown}
            style={{
              background: `linear-gradient(to right, #fff, transparent),
                           linear-gradient(to bottom, transparent, #000),
                           hsl(${hsv().h}, 100%, 50%)`,
            }}
          >
            <div
              class="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
              style={{
                left: `${hsv().s}%`,
                top: `${100 - hsv().v}%`,
                "background-color": hsvToHex(hsv().h, hsv().s, hsv().v),
              }}
            />
          </div>

          <div
            ref={hueRef}
            class="w-56 h-3 relative cursor-pointer rounded overflow-hidden"
            onMouseDown={handleHueMouseDown}
            style={{
              "background-image":
                "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            }}
          >
            <div
              class="absolute w-1 h-full -translate-x-1/2 bg-white border border-border shadow-sm"
              style={{
                left: `${(hsv().h / 360) * 100}%`,
              }}
            />
          </div>

          <input
            type="text"
            value={props.value}
            onInput={(e) => {
              const value = e.currentTarget.value;
              if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                props.onChange(value);
                setHsv(hexToHsv(value));
              }
            }}
            class="mt-2 w-full px-2 py-1 text-sm border border-border rounded bg-background text-text-primary"
          />
        </div>
      </Show>
    </div>
  );
};

export default ColorPicker;
