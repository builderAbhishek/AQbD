import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ProjectProvider } from './context/ProjectContext';
import AppShell from './components/layout/AppShell';

function App() {
  return (
    <Router>
      <ProjectProvider>
        <Routes>
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </ProjectProvider>
    </Router>
  );
}

export default App;
