import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createDomain, deleteDomain, getDomains } from '../api/client';

export function useDomains() {
  return useQuery({ queryKey: ['domains'], queryFn: getDomains });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      createDomain(name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteDomain(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domains'] }),
  });
}
