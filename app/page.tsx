'use client';

import { useState } from 'react';

interface TableData {
  [key: string]: any[];
}

export default function Home() {
  const [postgresUrl, setPostgresUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [data, setData] = useState<TableData>({});
  const [tableColumns, setTableColumns] = useState<Record<string, string[]>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, Set<string>>>({});
  const [filters, setFilters] = useState<Record<string, Record<string, string>>>({});
  
  // Delete operation states
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState(false);
  const [showDeleteTableModal, setShowDeleteTableModal] = useState(false);
  const [showDeleteSchemaModal, setShowDeleteSchemaModal] = useState(false);
  const [deleteConditions, setDeleteConditions] = useState('');
  const [deleteColumnName, setDeleteColumnName] = useState('');
  const [deleteTableName, setDeleteTableName] = useState('');
  const [deleteSchemaName, setDeleteSchemaName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTables([]);
    setData({});
    setSelectedTable(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postgresUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to connect to database');
      }

      setTables(result.tables || []);
      setData(result.data || {});
      setTableColumns(result.columns || {});
      
      // Initialize column selection and filters for all tables
      const initialColumns: Record<string, Set<string>> = {};
      const initialFilters: Record<string, Record<string, string>> = {};
      
      // Use column information from schema or data
      const columns = result.columns || {};
      Object.keys(columns).forEach((tableName) => {
        const headers = columns[tableName] || 
          (result.data?.[tableName] && result.data[tableName].length > 0 
            ? Object.keys(result.data[tableName][0]) 
            : []);
        if (headers.length > 0) {
          initialColumns[tableName] = new Set(headers);
          initialFilters[tableName] = {};
          headers.forEach((header: string) => {
            initialFilters[tableName][header] = '';
          });
        }
      });
      
      setSelectedColumns(initialColumns);
      setFilters(initialFilters);
      
      // Auto-select first table if available
      if (result.tables && result.tables.length > 0) {
        setSelectedTable(result.tables[0]);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTableHeaders = (tableName: string): string[] => {
    // First try to get from schema columns
    if (tableColumns[tableName] && tableColumns[tableName].length > 0) {
      return tableColumns[tableName];
    }
    // Fallback to data columns
    if (data[tableName] && data[tableName].length > 0) {
      return Object.keys(data[tableName][0]);
    }
    return [];
  };

  const toggleColumn = (tableName: string, columnName: string) => {
    setSelectedColumns((prev) => {
      const newSet = new Set(prev[tableName] || []);
      if (newSet.has(columnName)) {
        newSet.delete(columnName);
      } else {
        newSet.add(columnName);
      }
      return {
        ...prev,
        [tableName]: newSet,
      };
    });
  };

  const updateFilter = (tableName: string, columnName: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [tableName]: {
        ...prev[tableName],
        [columnName]: value,
      },
    }));
  };

  const getVisibleColumns = (tableName: string): string[] => {
    if (!selectedColumns[tableName]) {
      return getTableHeaders(tableName);
    }
    return getTableHeaders(tableName).filter((col) =>
      selectedColumns[tableName].has(col)
    );
  };


  const selectAllColumns = (tableName: string) => {
    const headers = getTableHeaders(tableName);
    setSelectedColumns((prev) => ({
      ...prev,
      [tableName]: new Set(headers),
    }));
  };

  const deselectAllColumns = (tableName: string) => {
    setSelectedColumns((prev) => ({
      ...prev,
      [tableName]: new Set(),
    }));
  };

  const clearFilters = (tableName: string) => {
    const headers = getTableHeaders(tableName);
    const clearedFilters: Record<string, string> = {};
    headers.forEach((header) => {
      clearedFilters[header] = '';
    });
    setFilters((prev) => ({
      ...prev,
      [tableName]: clearedFilters,
    }));
  };

  const getUniqueValues = (tableName: string, columnName: string): string[] => {
    if (!data[tableName]) {
      return [];
    }
    const values = new Set<string>();
    data[tableName].forEach((row) => {
      const value = row[columnName];
      if (value !== null && value !== undefined) {
        values.add(String(value));
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  };

  const getFilteredData = (tableName: string): any[] => {
    if (!data[tableName]) {
      return [];
    }

    const tableFilters = filters[tableName] || {};
    const hasActiveFilters = Object.values(tableFilters).some((val) => val.trim() !== '');

    if (!hasActiveFilters) {
      return data[tableName];
    }

    return data[tableName].filter((row) => {
      return Object.entries(tableFilters).every(([column, filterValue]) => {
        if (!filterValue.trim()) {
          return true;
        }
        const cellValue = row[column];
        if (cellValue === null || cellValue === undefined) {
          return false;
        }
        // Exact match for dropdown selection
        return String(cellValue) === filterValue;
      });
    });
  };

  const refreshData = async () => {
    if (!postgresUrl) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postgresUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to refresh data');
      }

      setTables(result.tables || []);
      setData(result.data || {});
      setTableColumns(result.columns || {});
      
      // Update column selection and filters
      const initialColumns: Record<string, Set<string>> = {};
      const initialFilters: Record<string, Record<string, string>> = {};
      
      // Use column information from schema or data
      const columns = result.columns || {};
      Object.keys(columns).forEach((tableName) => {
        const headers = columns[tableName] || 
          (result.data?.[tableName] && result.data[tableName].length > 0 
            ? Object.keys(result.data[tableName][0]) 
            : []);
        if (headers.length > 0) {
          initialColumns[tableName] = new Set(headers);
          initialFilters[tableName] = {};
          headers.forEach((header: string) => {
            initialFilters[tableName][header] = '';
          });
        }
      });
      
      setSelectedColumns(initialColumns);
      setFilters(initialFilters);
      
      // If current table was deleted, select first available
      if (result.tables && result.tables.length > 0) {
        if (!result.tables.includes(selectedTable || '')) {
          setSelectedTable(result.tables[0]);
        }
      } else {
        setSelectedTable(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteData = async () => {
    if (!selectedTable) return;
    
    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postgresUrl,
          operation: 'delete_data',
          tableName: selectedTable,
          conditions: deleteConditions.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete data');
      }

      setShowDeleteDataModal(false);
      setDeleteConditions('');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete data');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteColumn = async () => {
    if (!selectedTable || !deleteColumnName) return;
    
    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postgresUrl,
          operation: 'delete_column',
          tableName: selectedTable,
          columnName: deleteColumnName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete column');
      }

      setShowDeleteColumnModal(false);
      setDeleteColumnName('');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete column');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!deleteTableName) return;
    
    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postgresUrl,
          operation: 'delete_table',
          tableName: deleteTableName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete table');
      }

      setShowDeleteTableModal(false);
      setDeleteTableName('');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete table');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteSchema = async () => {
    if (!deleteSchemaName) return;
    
    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postgresUrl,
          operation: 'delete_schema',
          schemaName: deleteSchemaName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete schema');
      }

      setShowDeleteSchemaModal(false);
      setDeleteSchemaName('');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete schema');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 pt-16 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            PostgreSQL Database Viewer
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enter your PostgreSQL connection URL to view all tables and data
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="postgresUrl"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                PostgreSQL Connection URL
              </label>
              <input
                type="text"
                id="postgresUrl"
                value={postgresUrl}
                onChange={(e) => setPostgresUrl(e.target.value)}
                placeholder="postgresql://username:password@host:port/database?sslmode=require"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {loading ? 'Connecting...' : 'Get Data'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-400 font-medium">Error:</p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}
        </div>

        {tables.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Tables ({tables.length})
                </h2>
                <button
                  onClick={() => setShowDeleteSchemaModal(true)}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Delete Schema
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tables.map((table) => (
                  <div key={table} className="relative group">
                    <button
                      onClick={() => setSelectedTable(table)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedTable === table
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {table}
                      <span className="ml-2 text-xs opacity-75">
                        ({data[table]?.length || 0} rows)
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTableName(table);
                        setShowDeleteTableModal(true);
                      }}
                      className="ml-2 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete table"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {selectedTable && data[selectedTable] && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Table: {selectedTable}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => clearFilters(selectedTable)}
                      className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Clear Filters
                    </button>
                    <button
                      onClick={() => setShowDeleteDataModal(true)}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      Delete Data
                    </button>
                  </div>
                </div>

                {/* Column Selection */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Select Columns to Display
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectAllColumns(selectedTable)}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => deselectAllColumns(selectedTable)}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {getTableHeaders(selectedTable).map((header) => (
                      <div key={header} className="flex items-center justify-between group">
                        <label
                          className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 flex-1"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns[selectedTable]?.has(header) ?? true}
                            onChange={() => toggleColumn(selectedTable, header)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {header}
                          </span>
                        </label>
                        <button
                          onClick={() => {
                            setDeleteColumnName(header);
                            setShowDeleteColumnModal(true);
                          }}
                          className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                          title="Delete column"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filters */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Filter Rows by Category
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Select a value from each column to filter the data
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getTableHeaders(selectedTable).map((header) => {
                      const uniqueValues = getUniqueValues(selectedTable, header);
                      const hasValues = uniqueValues.length > 0;
                      const isManyValues = uniqueValues.length > 50;
                      
                      return (
                        <div key={header}>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {header}
                            {hasValues && (
                              <span className="ml-1 text-gray-400">
                                ({uniqueValues.length} {uniqueValues.length === 1 ? 'option' : 'options'})
                              </span>
                            )}
                          </label>
                          {isManyValues ? (
                            <>
                              <input
                                type="text"
                                list={`${selectedTable}-${header}-datalist`}
                                value={filters[selectedTable]?.[header] || ''}
                                onChange={(e) =>
                                  updateFilter(selectedTable, header, e.target.value)
                                }
                                placeholder={`Type or select ${header}...`}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                              />
                              <datalist id={`${selectedTable}-${header}-datalist`}>
                                {uniqueValues.map((value) => (
                                  <option key={value} value={value} />
                                ))}
                              </datalist>
                            </>
                          ) : (
                            <select
                              value={filters[selectedTable]?.[header] || ''}
                              onChange={(e) =>
                                updateFilter(selectedTable, header, e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">All {header}</option>
                              {uniqueValues.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                  {getVisibleColumns(selectedTable).length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-gray-500 dark:text-gray-400">
                        No columns selected. Please select at least one column to display.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        Showing {getFilteredData(selectedTable).length} of{' '}
                        {data[selectedTable].length} rows
                      </div>
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            {getVisibleColumns(selectedTable).map((header) => (
                              <th
                                key={header}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {getFilteredData(selectedTable).length === 0 ? (
                            <tr>
                              <td
                                colSpan={getVisibleColumns(selectedTable).length}
                                className="px-6 py-4 text-center text-gray-500 dark:text-gray-400"
                              >
                                No data matches the current filters
                              </td>
                            </tr>
                          ) : (
                            getFilteredData(selectedTable).map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                {getVisibleColumns(selectedTable).map((header) => (
                                  <td
                                    key={header}
                                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                                  >
                                    {row[header] !== null && row[header] !== undefined
                                      ? String(row[header])
                                      : (
                                          <span className="text-gray-400 italic">null</span>
                                        )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
                {data[selectedTable].length >= 1000 && (
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Note: Displaying first 1000 rows from database
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete Data Modal */}
        {showDeleteDataModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Delete Data from {selectedTable}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This action cannot be undone. Enter WHERE conditions to delete specific rows, or leave empty to delete all data.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  WHERE Conditions (optional)
                </label>
                <input
                  type="text"
                  value={deleteConditions}
                  onChange={(e) => setDeleteConditions(e.target.value)}
                  placeholder='e.g., id = 1 OR status = "inactive"'
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave empty to delete all data from the table
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDataModal(false);
                    setDeleteConditions('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Data'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Column Modal */}
        {showDeleteColumnModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Delete Column
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete column <strong>"{deleteColumnName}"</strong> from table <strong>"{selectedTable}"</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteColumnModal(false);
                    setDeleteColumnName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteColumn}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Column'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Table Modal */}
        {showDeleteTableModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Delete Table
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete table <strong>"{deleteTableName}"</strong>? This will permanently delete the table and all its data. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteTableModal(false);
                    setDeleteTableName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTable}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Table'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Schema Modal */}
        {showDeleteSchemaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Delete Schema
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Warning: Deleting a schema will permanently delete all tables, data, and objects within it. This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Schema Name
                </label>
                <input
                  type="text"
                  value={deleteSchemaName}
                  onChange={(e) => setDeleteSchemaName(e.target.value)}
                  placeholder="Enter schema name"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                />
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Note: Cannot delete the "public" schema
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteSchemaModal(false);
                    setDeleteSchemaName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSchema}
                  disabled={deleteLoading || !deleteSchemaName.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Schema'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
