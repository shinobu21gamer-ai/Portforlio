import { useState } from 'react';
import ErrorState from '../components/ErrorState';
import { useQuery } from '@tanstack/react-query';
import posApi from '../api/posClient';
import DataTable from '../components/DataTable';
import useDebounce from '../hooks/useDebounce';

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'slug', label: 'Slug', sortable: true },
  { key: 'description', label: 'Description', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
];

export default function InvCategories() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  // Clicking a header toggles the direction on the same column and jumps back to
  // the first page. The sort runs on the API (each service whitelists the columns
  // it accepts), so the whole list stays ordered rather than just the loaded page.
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else { setSortBy(field); setSortOrder('ASC'); }
    setPage(1);
  };

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inv-categories', page, debouncedSearch, sortBy, sortOrder],
    queryFn: () => posApi.get('/categories', { params: { page, limit: 100, search: debouncedSearch || undefined, sortBy, sortOrder } }).then(r => r.data.data),
  });

  const categories = data?.categories || [];
  const pagination = data?.pagination;

  if (isError) {
    return (
      <div className="page-error-wrap">
        <ErrorState message={error?.response?.data?.message || 'Something went wrong while loading this data.'} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <>
      <header className="pos-header">
        <div><h1>Categories</h1><div className="sub">{pagination?.totalItems || 0} categories</div></div>
      </header>
      <div className="search-bar">
        <div className="flex-1 pos-rel">
          <input className="input-block" placeholder="Search categories..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: '100%', paddingRight: search ? 28 : undefined }} />
          {search && <button onClick={() => { setSearch(''); setPage(1); }} className="search-clear" style={{ right: 6 }}>&times;</button>}
        </div>
      </div>
      <DataTable columns={columns} data={categories} pagination={pagination} onPageChange={setPage} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} isLoading={isLoading} emptyMessage="No categories found"
        renderRow={(c, _idx, visHeaders) => {
          const cellMap = {
            name: <td><strong>{c.name}</strong></td>,
            slug: <td className="mono">{c.slug}</td>,
            description: <td className="w-250 truncate">{c.description || '—'}</td>,
            status: <td><span className={`badge ${c.isActive ? 'success' : 'error'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>,
          };
          return <tr key={c.id}>{visHeaders.map(c => cellMap[c.key])}</tr>;
        }}
      />
    </>
  );
}
