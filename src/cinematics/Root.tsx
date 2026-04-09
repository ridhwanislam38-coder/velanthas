import { Composition } from 'remotion';
import { PrologueCinematic } from './PrologueCinematic';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PrologueCinematic"
        component={PrologueCinematic}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
