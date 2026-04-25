import Toolbar from './components/Toolbar/Toolbar';
import Sidebar from './components/Panels/Sidebar';
import CircuitCanvas from './components/Canvas/CircuitCanvas';
import PropertyPanel from './components/Panels/PropertyPanel';
import StatusBar from './components/Panels/StatusBar';
import FaultDialog from './components/Dialogs/FaultDialog';

function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-900">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <CircuitCanvas />
        <PropertyPanel />
      </div>
      <StatusBar />
      <FaultDialog />
    </div>
  );
}

export default App;
