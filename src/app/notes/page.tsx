"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStickyNote,
} from "@fortawesome/free-solid-svg-icons";

export default function Notes() {

  return (
    <div className="friends">
      <div className="header">
        <h1><FontAwesomeIcon icon={faStickyNote}/>&nbsp;&nbsp;<b>Notes</b></h1>
      </div>
    </div>
  );
}
