import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DomainDetailPage } from './pages/DomainDetailPage';
import { DomainsPage } from './pages/DomainsPage';
import { QueryPage } from './pages/QueryPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<DomainsPage />} />
          <Route path="/domains/:name" element={<DomainDetailPage />} />
          <Route path="/domains/:name/query" element={<QueryPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
