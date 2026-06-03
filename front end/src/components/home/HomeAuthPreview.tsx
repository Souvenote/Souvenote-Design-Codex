"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";

const previewUser = {
  name: "Cameron Wilson",
  email: "cameron@souvenote.com",
  initials: "CW",
};

export function HomeAuthPreview() {
  const [loggedIn, setLoggedIn] = useState(true);

  return (
    <>
      <Navbar
        loggedIn={loggedIn}
        user={previewUser}
        credits={{ images: 10, songs: 0 }}
        cartCount={1}
      />
      <div className="souv-view-toggle souv-auth-view-toggle" aria-label="Homepage auth preview">
        <span>View</span>
        <button
          className={!loggedIn ? "is-active" : ""}
          type="button"
          onClick={() => setLoggedIn(false)}
          aria-pressed={!loggedIn}
        >
          Logged Out
        </button>
        <button
          className={loggedIn ? "is-active" : ""}
          type="button"
          onClick={() => setLoggedIn(true)}
          aria-pressed={loggedIn}
        >
          Logged In
        </button>
      </div>
    </>
  );
}
