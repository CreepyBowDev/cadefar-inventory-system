import { RouterProvider } from 'react-router-dom';
import { router } from './app/router.jsx';
import { AuthProvider } from './features/auth/context/AuthContext.jsx';

export const App = () => (
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
);
