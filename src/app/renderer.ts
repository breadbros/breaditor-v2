import { init } from "./ReactDockableApp";
import css from "./globals.module.css";
import SamJs from "sam-js";

//////////////////////
// From Tray
let sam = new SamJs();

function sayWords(words: string) {
  sam.speak(words);
}

function playSound(id: string) {
  var audio = document.getElementById(id) as any;
  audio.play();
}

function create_audio(label: string, file: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.onclick = () => {
    playSound(label);
  };
  button.innerText = label;

  const audio = document.createElement("audio");
  audio.src = file;
  audio.id = label;

  button.appendChild(audio);

  return button;
}

console.log("here I go, rendering again!");

// try {
//   const root = document.getElementsByTagName("body")[0];
//   const audio1 = create_audio("audio 1", "./resources/fail.wav");
//   const audio2 = create_audio("audio 2", "./resources/sully-fanfare.ogg");
//   const audio3 = create_audio(
//     "audio 3",
//     "./resources/you-did-something-yay.wav",
//   );
//   const audio4 = create_audio("audio 4", "./resources/pass.wav");

//   root.appendChild(audio1);
//   root.appendChild(audio2);
//   root.appendChild(audio3);
//   root.appendChild(audio4);
// } catch (e) {
//   console.error(e);
//   alert("error: " + e.message);
// }

window["ipcComms"].onShowAlert((value) => {
  alert(value);
});

window["ipcComms"].onRefreshPage((value) => {
  location.reload();
});

window["ipcComms"].onPlaySound((value) => {
  playSound(value);
});

window["ipcComms"].onSayWords((value) => {
  sayWords(value);
});
// from tray
//////////////////////////////////////////
// from breaditor

function appendGlobalCss() {
  const head = document.head;
  const style = document.createElement("style");
  style.type = "text/css";

  style.textContent = css;
  head.appendChild(style);
}

function startApp() {
  appendGlobalCss();
  init();
}

// @ts-ignore
window['startApp'] = startApp; //we call this in the index.html after loading to bootstrap.
// we don't call it here so we don't init anything for unit testing

export { appendGlobalCss, startApp };
