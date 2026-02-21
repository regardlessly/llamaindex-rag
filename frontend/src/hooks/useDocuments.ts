import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDocuments, uploadPdfs } from '../api/client';

export function useDocuments(domain: string) {
  return useQuery({
    queryKey: ['documents', domain],
    queryFn: () => getDocuments(domain),
    enabled: !!domain,
  });
}

export function useUploadPdfs(domain: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => uploadPdfs(domain, files),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', domain] });
      qc.invalidateQueries({ queryKey: ['domains'] });
    },
  });
}
