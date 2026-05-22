import re
import sys

def patch_file(filepath, state_loading_var):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    start_str = "{/* Pagination Footer */}"
    start_idx = content.find(start_str)
    if start_idx == -1:
        print(f"Could not find pagination footer in {filepath}")
        return
        
    end_idx = content.find("<MergeModal", start_idx)
    if end_idx == -1:
        end_idx = content.find("<Drawer", start_idx)
    if end_idx == -1:
        end_idx = content.find("{/* Drawers", start_idx)
        
    if end_idx == -1:
        print(f"Could not find end of pagination footer in {filepath}")
        return

    with open(filepath + '.bak', 'w', encoding='utf-8') as f:
        f.write(content)

    new_pagination = """{/* Pagination Footer */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
            const getPageNumbers = () => {
              const pages = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                if (page <= 4) {
                  for (let i = 1; i <= 5; i++) pages.push(i);
                  pages.push('...');
                  pages.push(totalPages);
                } else if (page >= totalPages - 3) {
                  pages.push(1);
                  pages.push('...');
                  for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  pages.push('...');
                  pages.push(page - 1);
                  pages.push(page);
                  pages.push(page + 1);
                  pages.push('...');
                  pages.push(totalPages);
                }
              }
              return pages;
            };
  
            return (
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-6 py-6 border-t border-border bg-surface-2/30">
                <div className="text-xs font-bold text-text-muted uppercase tracking-widest text-center lg:text-left">
                  Showing <span className="text-text-primary">{totalCount === 0 ? 0 : (page - 1) * pageSize + 1}</span> to <span className="text-text-primary">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-text-primary">{totalCount}</span> Items
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1 || REPLACEME_LOADING}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <Icon icon="solar:double-alt-arrow-left-linear" width="16" />
                    First
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1 || REPLACEME_LOADING}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    <Icon icon="solar:alt-arrow-left-linear" width="16" />
                    Prev
                  </button>
  
                  {getPageNumbers().map((p, i) => (
                    p === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-text-muted">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-xs font-bold transition-all ${
                          page === p 
                            ? 'bg-brand text-white shadow-md' 
                            : 'text-text-primary hover:bg-surface-2'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}
  
                  <button
                    onClick={() => setPage(prev => (prev < totalPages ? prev + 1 : prev))}
                    disabled={page === totalPages || REPLACEME_LOADING}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    Next
                    <Icon icon="solar:alt-arrow-right-linear" width="16" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || REPLACEME_LOADING}
                    className="px-3 py-2 text-xs font-bold text-text-primary rounded-md hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                  >
                    Last
                    <Icon icon="solar:double-alt-arrow-right-linear" width="16" />
                  </button>
  
                  <div className="flex items-center gap-2 ml-2 pl-2 lg:ml-4 lg:pl-4 border-l border-border">
                    <span className="text-xs font-bold text-text-muted">Go to</span>
                    <input 
                      key={page}
                      type="number" 
                      defaultValue={page}
                      min={1}
                      max={totalPages}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setPage(val);
                        } else {
                          e.target.value = page;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt(e.currentTarget.value);
                          if (!isNaN(val) && val >= 1 && val <= totalPages) {
                            setPage(val);
                          } else {
                            e.currentTarget.value = page;
                          }
                        }
                      }}
                      className="w-16 px-2 py-1 text-xs font-bold bg-surface border border-border rounded-md text-center focus:outline-none focus:border-brand text-text-primary"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>"""
    
    new_pagination = new_pagination.replace("REPLACEME_LOADING", state_loading_var)

    before = content[:start_idx]
    after = content[end_idx:]
    
    new_content = before + new_pagination + "\n\n        <" + after.lstrip("<")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Patched {filepath}")

patch_file('src/pages/admin/AdminFilms.jsx', 'loading')
patch_file('src/pages/admin/AdminPeople.jsx', 'isLoading')
