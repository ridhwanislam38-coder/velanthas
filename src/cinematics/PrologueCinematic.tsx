import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const PrologueCinematic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Title: "VELANTHAS" fades in from frame 0-45 (0-1.5s) ---
  const titleOpacity = interpolate(frame, [0, 45], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 100, mass: 0.8 },
  });

  // --- Subtitle: "THE ACCORD'S SILENCE" fades in from frame 45-75 (1.5-2.5s) ---
  const subtitleOpacity = interpolate(frame, [45, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Line 1: "Four hundred years the Accord held." frame 90-120 (3-4s) ---
  const line1Opacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line1FadeOut = interpolate(frame, [150, 165], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Line 2: "And then, without warning..." frame 165-195 (5.5-6.5s) ---
  const line2Opacity = interpolate(frame, [165, 185], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line2FadeOut = interpolate(frame, [220, 235], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Line 3: "...silence." frame 235-260 (7.8-8.7s), holds then fades ---
  const line3Opacity = interpolate(frame, [235, 255], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // --- Final fade to black: frame 275-300 (9.2-10s) ---
  const finalFade = interpolate(frame, [275, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title group fades out when narration lines begin
  const titleGroupFadeOut = interpolate(frame, [80, 95], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Narrator voice line */}
      <Audio src={staticFile('generated/audio/dialogue/narrator_prologue.mp3')} />

      {/* Title: VELANTHAS */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: titleOpacity * titleGroupFadeOut,
        }}
      >
        <div
          style={{
            color: 'white',
            fontFamily: 'Georgia, serif',
            fontSize: 120,
            fontWeight: 'bold',
            letterSpacing: 16,
            transform: `scale(${titleScale})`,
            textAlign: 'center',
          }}
        >
          VELANTHAS
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: '#b0b0b0',
            fontFamily: 'Georgia, serif',
            fontSize: 36,
            letterSpacing: 12,
            marginTop: 24,
            opacity: subtitleOpacity,
            textAlign: 'center',
          }}
        >
          THE ACCORD&apos;S SILENCE
        </div>
      </AbsoluteFill>

      {/* Narration lines */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Line 1 */}
        <div
          style={{
            position: 'absolute',
            color: 'white',
            fontFamily: 'Georgia, serif',
            fontSize: 48,
            fontStyle: 'italic',
            opacity: line1Opacity * line1FadeOut,
            textAlign: 'center',
            padding: '0 120px',
          }}
        >
          Four hundred years the Accord held.
        </div>

        {/* Line 2 */}
        <div
          style={{
            position: 'absolute',
            color: 'white',
            fontFamily: 'Georgia, serif',
            fontSize: 48,
            fontStyle: 'italic',
            opacity: line2Opacity * line2FadeOut,
            textAlign: 'center',
            padding: '0 120px',
          }}
        >
          And then, without warning...
        </div>

        {/* Line 3 */}
        <div
          style={{
            position: 'absolute',
            color: 'white',
            fontFamily: 'Georgia, serif',
            fontSize: 56,
            fontStyle: 'italic',
            opacity: line3Opacity,
            textAlign: 'center',
            padding: '0 120px',
          }}
        >
          ...silence.
        </div>
      </AbsoluteFill>

      {/* Final fade to black overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: 'black',
          opacity: finalFade,
        }}
      />
    </AbsoluteFill>
  );
};
