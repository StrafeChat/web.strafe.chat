"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCompass,
} from "@fortawesome/free-solid-svg-icons";

export default function Discover() {

  return (
      <div className="header">
        <h1><FontAwesomeIcon icon={faCompass}/>&nbsp;&nbsp;<b>Discover</b></h1>
      </div>
  );
}
