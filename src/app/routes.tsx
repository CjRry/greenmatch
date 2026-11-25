import { Navigate, type RouteObject } from 'react-router'
import { Shell } from './Shell'
import { NotFound, RouteError } from './NotFound'
import Landing from '../features/market/pages/Landing'
import Register from '../features/market/pages/Register'
import EditProfile from '../features/market/pages/EditProfile'
import NeedsBoard from '../features/market/pages/NeedsBoard'
import NeedDetail from '../features/market/pages/NeedDetail'
import VendorDirectory from '../features/market/pages/VendorDirectory'
import VendorProfile from '../features/market/pages/VendorProfile'
import FactoryProfile from '../features/market/pages/FactoryProfile'
import Feedback from '../features/market/pages/Feedback'
import Hub from '../features/workspace/pages/Hub'
import CaseCenter from './CaseCenter'
import PublicCases from './PublicCases'
import BillCheckup from './BillCheckup'
import { AboutPage, MethodologyPage } from './TrustPages'
import QuoteSubmit from '../features/workspace/pages/QuoteSubmit'
import NeedWizard from '../features/ai/pages/NeedWizard'
import MatchResult from '../features/ai/pages/MatchResult'
import QuoteCompare from '../features/ai/pages/QuoteCompare'
import CarbonDashboard from '../features/carbon/pages/CarbonDashboard'
import CarbonEntry from '../features/carbon/pages/CarbonEntry'

/**
 * The whole route table (CEO-owned). Agents fill in their page files and never add routes here.
 * Links are built with `paths` from src/core/paths.ts.
 */
export const routes: RouteObject[] = [
  {
    element: <Shell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/register', element: <Register /> },
      { path: '/needs', element: <NeedsBoard /> },
      { path: '/needs/:id', element: <NeedDetail /> },
      { path: '/vendors', element: <VendorDirectory /> },
      { path: '/vendors/new', element: <Navigate to="/register?role=vendor" replace /> },
      { path: '/vendors/:id', element: <VendorProfile /> },
      { path: '/factories/new', element: <Navigate to="/register?role=factory" replace /> },
      { path: '/factories/:id', element: <FactoryProfile /> },
      { path: '/me', element: <Hub /> },
      { path: '/me/profile', element: <EditProfile /> },
      { path: '/new-need', element: <NeedWizard /> },
      { path: '/cases/:id', element: <CaseCenter /> },
      { path: '/cases/:id/match', element: <MatchResult /> },
      { path: '/cases/:id/quotes', element: <QuoteCompare /> },
      { path: '/cases/:id/quote/new', element: <QuoteSubmit /> },
      { path: '/carbon', element: <CarbonDashboard /> },
      { path: '/carbon/entry', element: <CarbonEntry /> },
      { path: '/bill-checkup', element: <BillCheckup /> },
      { path: '/feedback', element: <Feedback /> },
      { path: '/public-cases', element: <PublicCases /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/methodology', element: <MethodologyPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
