import { NavLink, Outlet, Link } from 'react-router-dom';
import { Bot, LayoutDashboard, Plus, Settings, Sparkles } from 'lucide-react';
import { demoMode } from '../services/api';

export function Layout() {
  const modeLabel = demoMode ? 'Demo data' : 'Backend mode';

  return (
    <div className="shell">
      <aside>
        <Link to="/" className="brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>Vaani<span>Setu</span></span>
        </Link>
        <div className="side-label">WORKSPACE</div>
        <nav>
          <NavLink to="/dashboard"><LayoutDashboard size={18} />Overview</NavLink>
          <NavLink to="/builder"><Plus size={18} />Create agent</NavLink>
        </nav>
        <div className="side-bottom">
          <div className="side-label">PLATFORM</div>
          <div className="plan-card">
            <div className="plan-icon"><Bot size={17} /></div>
            <div><strong>Voice + appointments</strong><small>{modeLabel}</small></div>
          </div>
          <NavLink to="/settings"><Settings size={18} />Settings</NavLink>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <div className="crumb">Workspace <span>/</span> VaaniSetu</div>
          <div className="demo-pill"><i />{modeLabel}</div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
