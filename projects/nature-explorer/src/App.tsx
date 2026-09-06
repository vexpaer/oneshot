import { Scene } from "./scene/Scene";
import { Overlay } from "./ui/Overlay";
import { useStore } from "./world/store";
import { world } from "./world/world";

// debug hooks (harmless in production)
(window as unknown as { __ne: unknown }).__ne = { store: useStore, world };

export default function App() {
  return (
    <div className="app">
      <div className="canvas-wrap">
        <Scene />
      </div>
      <Overlay />
    </div>
  );
}
