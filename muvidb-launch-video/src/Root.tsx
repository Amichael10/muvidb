import "./index.css";
import { MyComposition } from "./Composition";
import { ActorAlertCompositions } from "./actor-alert/Root";
import { RewindCompositions } from "./rewind/Root";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <ActorAlertCompositions />
      <RewindCompositions />
    </>
  );
};
