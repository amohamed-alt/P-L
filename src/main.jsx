import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TeamActivity, ViewerAccess } from './Access';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {window.location.pathname === '/team-activity' ? <TeamActivity /> : <ViewerAccess />}
  </StrictMode>,
);

