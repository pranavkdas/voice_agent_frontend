'use client'
import React, { useEffect, useRef, useState } from "react";

const MicSpeakerVisualizer = () => {
  const [volume, setVolume] = useState(0);
  const animationIdRef = useRef(null);

  useEffect(() => {
    let audioContext;
    let analyser;
    let dataArray;
    let source;

    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Smaller fftSize for smoother bar update
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const updateVolume = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            // Normalize sample (centered at 128) to range 0-1
            const normalized = Math.abs((dataArray[i] - 128) / 128);
            sum += normalized;
          }
          const avg = sum / dataArray.length;
          setVolume(Math.min(1, avg * 2));
          animationIdRef.current = requestAnimationFrame(updateVolume);
        };

        updateVolume();
      } catch (err) {
        console.error("Error accessing microphone:", err);
      }
    }

    setupAudio();
    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (audioContext) audioContext.close();
    };
  }, []);

  // We want the bars to be arranged in a circle and extend perpendicularly (radially) outward.
  // To achieve this, if the default orientation of a bar (with no rotation) is vertical (pointing up),
  // then for a bar at angle = 0 (pointing to the right), we need to rotate it by 90° (pi/2 radians).
  // Thus, the required rotation is angle + π/2.
  const numBars = 40;
  const maxBarHeight = 60; // Maximum bar height in pixels
  const currentBarHeight = volume * maxBarHeight;

  return (
    <div
      style={{
        position: "relative",
        width: "100px",
        height: "100px",
        margin: "20px auto",
      }}
    >
      {/* Microphone Icon in the Center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2,
          width: "40px",
          height: "40px",
        }}
      >
        <svg viewBox="0 0 24 24" fill="#444" width="100%" height="100%">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M19 11v-1a1 1 0 0 0-1-1h-1V5a1 1 0 0 0-1-1H8A1 1 0 0 0 7 5v4H6a1 1 0 0 0-1 1v1a7 7 0 0 0 14 0z" />
          <path d="M12 18a5 5 0 0 0 5-5H7a5 5 0 0 0 5 5z" />
        </svg>
      </div>
      {/* Bars arranged radially */}
      {Array.from({ length: numBars }).map((_, index) => {
        const angle = (index / numBars) * 2 * Math.PI;
        // Anchor bars at a fixed radius from the center
        const radius = 50;
        // Calculate offset position from center:
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const height_factor =  Math.max(Math.floor((Math.random() * 0.5)*currentBarHeight), currentBarHeight*0.2)
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "4px",
              height: `${height_factor}px`,
              background: "#00ff00",
              // Rotate each bar by (angle + π/2) so that it extends radially
              transform: `translate(${x}px, ${y}px) rotate(${angle + Math.PI / 2}rad) translateY(-${height_factor}px)`,
              transformOrigin: "center bottom",
            }}
          />
        );
      })}
    </div>
  );
};

export default MicSpeakerVisualizer;
