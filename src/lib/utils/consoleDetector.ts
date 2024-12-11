interface ConsoleMessage {
  text: string;
  style: string;
}

const messages: ConsoleMessage[] = [
  {
    text: "Strafe",
    style: "font-size: 50px; color: #21c35e;",
  },
  {
    text: "This is a browser feature intended for developers. If someone told you to copy and paste something here, don't do it. It may compromise your account. \n",
    style: "font-size: 16px;",
  },
  {
    text: 'DO NOT GIVE ANYONE YOUR SESSION TOKEN LABELED "sc_token", THEY WILL HAVE UNRESTRICTED ACCESS TO YOUR ACCOUNT BYPASSING 2FA.',
    style: "font-size: 35px; color: red;",
  },
  {
    text: "If your session token is compromised, you can invalidate it by logging out of that session. You can invalidate all sessions by going to the settings page and clicking 'invalidate all sessions'.",
    style: "font-size: 16px;",
  },
];

function printWarningMessages(): void {
  messages.forEach((message) => {
    console.log(`%c${message.text}`, message.style);
  });
}

export function initConsoleDetector(): void {
  const originalClear = console.clear.bind(console);
  let lastPrintTime = 0;
  const PRINT_COOLDOWN = 10000;

  console.clear = function (this: typeof console): void {
    originalClear.call(this);
    const now = Date.now();
    if (now - lastPrintTime > PRINT_COOLDOWN) {
      lastPrintTime = now;
      printWarningMessages();
    }
  };

  Object.defineProperty(window, "devtools", {
    get: function () {
      printWarningMessages();
      return null;
    },
  });

  setInterval(() => {
    const heightThreshold = window.outerHeight - window.innerHeight > 100;
    const widthThreshold = window.outerWidth - window.innerWidth > 100;

    if (heightThreshold || widthThreshold) {
      const now = Date.now();
      if (now - lastPrintTime > PRINT_COOLDOWN) {
        lastPrintTime = now;
        printWarningMessages();
      }
    }
  }, 1000);

  setInterval(() => {
    const startTime = performance.now();
    console.debug();
    const endTime = performance.now();

    if (endTime - startTime > 100) {
      const now = Date.now();
      if (now - lastPrintTime > PRINT_COOLDOWN) {
        lastPrintTime = now;
        printWarningMessages();
      }
    }
  }, 1000);

  setTimeout(printWarningMessages, 1000);
}
