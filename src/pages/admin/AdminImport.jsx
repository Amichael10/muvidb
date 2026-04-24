import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import * as XLSX from 'xlsx';

const CONTENT_TYPES = {
  movies: {
    label: 'Movies',
    icon: 'solar:clapperboard-play-linear',
    required: ['title', 'year'],
    table: 'films',
    mapping: (row) => ({
      title: row.title,
      year: parseInt(row.year),
      synopsis: row.synopsis || null,
      poster_url: row.poster_url || null,
      backdrop_url: row.backdrop_url || null,
      runtime_minutes: row.runtime ? parseInt(row.runtime) : null,
      tmdb_rating: row.rating ? parseFloat(row.rating) : null,
      trailer_youtube_id: row.trailer_id || null,
      release_type: row.release_type || 'cinema',
      youtube_watch_url: row.youtube_link || null,
      language: row.language || 'English',
      status: row.status || 'released',
      streaming_links: {
        netflix: row.link_netflix || null,
        kava: row.link_kava || null,
        prime: row.link_prime || null
      }
    })
  },
  people: {
    label: 'People',
    icon: 'solar:user-linear',
    required: ['name'],
    table: 'people',
    mapping: (row) => ({
      name: row.name,
      bio: row.bio || null,
      photo_url: row.photo_url || null,
      date_of_birth: row.birth_date || null,
      nationality: row.nationality || 'Nigerian',
      is_verified: String(row.verified).toLowerCase() === 'true',
      youtube_channel_id: row.yt_channel_id || null
    })
  },
  channels: {
    label: 'YouTube Channels',
    icon: 'solar:videocamera-record-linear',
    required: ['name', 'channel_id'],
    table: 'channels',
    mapping: (row) => ({
      name: row.name,
      channel_id: row.channel_id,
      channel_handle: row.handle || null,
      category: row.type || 'Movies',
      thumbnail_url: row.avatar_url || null,
      banner_url: row.backdrop_url || null,
      is_featured: String(row.is_featured).toLowerCase() === 'true'
    })
  }
};

export default function AdminImport() {
  const [selectedType, setSelectedType] = useState('movies');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [fileData, setFileData] = useState([]);
  const fileInputRef = useRef(null);

  const downloadTemplate = (type) => {
    const config = CONTENT_TYPES[type];
    const headers = config.required.concat(
      Object.keys(config.mapping({})).filter(k => !config.required.includes(k) && k !== 'streaming_links')
    );
    
    let finalHeaders = headers;
    if (type === 'movies') finalHeaders = headers.concat(['link_netflix', 'link_kava', 'link_prime']);

    const ws = XLSX.utils.aoa_to_sheet([finalHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Manual anchor download to ensure extension is forced
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lumi_${config.label}_Template.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTemplateMd = (type) => {
    const config = CONTENT_TYPES[type];
    const headers = config.required.concat(
      Object.keys(config.mapping({})).filter(k => !config.required.includes(k) && k !== 'streaming_links')
    );
    
    let finalHeaders = headers;
    if (type === 'movies') finalHeaders = headers.concat(['link_netflix', 'link_kava', 'link_prime']);

    let md = `# Lumi ${config.label} Import Template\n\n`;
    md += `| ${finalHeaders.join(' | ')} |\n`;
    md += `| ${finalHeaders.map(() => '---').join(' | ')} |\n`;
    md += `| ${finalHeaders.map(h => config.required.includes(h) ? 'REQUIRED' : 'optional').join(' | ')} |\n\n`;
    
    md += `## Instructions\n`;
    md += `1. Do not rename the column headers.\n`;
    md += `2. Fill out all REQUIRED fields.\n`;
    md += `3. Upload this file via the Lumi Admin Import Hub.\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lumi_${config.label}_Template.md`;
    a.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error("The uploaded file is empty.");
          return;
        }

        // Basic validation of headers
        const headers = Object.keys(data[0]);
        const missing = CONTENT_TYPES[selectedType].required.filter(h => !headers.includes(h));
        
        if (missing.length > 0) {
          toast.error(`Missing required columns: ${missing.join(', ')}`);
          return;
        }

        setFileData(data);
        toast.success(`Loaded ${data.length} rows. Ready to import.`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const executeImport = async () => {
    if (fileData.length === 0) return;
    
    setIsProcessing(true);
    setImportResults(null);
    const config = CONTENT_TYPES[selectedType];
    const results = {
      success: [],
      failed: []
    };

    toast.loading(`Importing ${fileData.length} records...`, { id: 'import' });

    for (let i = 0; i < fileData.length; i++) {
      const rawRow = fileData[i];
      
      // 1. Check required fields
      const missing = config.required.filter(field => !rawRow[field]);
      if (missing.length > 0) {
        results.failed.push({
          row: i + 1,
          identifier: rawRow.title || rawRow.name || `Row ${i + 1}`,
          reason: `Missing required: ${missing.join(', ')}`
        });
        continue;
      }

      try {
        const mappedData = config.mapping(rawRow);
        
        // 2. Save to Supabase
        let saveError = null;
        
        if (config.table === 'people') {
          // Special handling for people because there is no unique constraint on 'name'
          const { data: existing } = await supabase
            .from('people')
            .select('id')
            .eq('name', mappedData.name)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('people')
              .update(mappedData)
              .eq('id', existing.id);
            saveError = error;
          } else {
            const { error } = await supabase
              .from('people')
              .insert([mappedData]);
            saveError = error;
          }
        } else {
          // Normal upsert for films and channels
          const { error } = await supabase
            .from(config.table)
            .upsert(mappedData, { 
              onConflict: config.table === 'films' ? 'title,year' : 'channel_id' 
            });
          saveError = error;
        }

        if (saveError) throw saveError;

        results.success.push({
          row: i + 1,
          identifier: rawRow.title || rawRow.name
        });
      } catch (err) {
        results.failed.push({
          row: i + 1,
          identifier: rawRow.title || rawRow.name || `Row ${i + 1}`,
          reason: err.message
        });
      }
    }

    setImportResults(results);
    setIsProcessing(false);
    setFileData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    toast.success(`Import complete! ${results.success.length} successful, ${results.failed.length} failed.`, { id: 'import' });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-brand text-xs font-bold mb-1 tracking-widest uppercase opacity-80 italic">Data Management</p>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Bulk Import Hub</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.keys(CONTENT_TYPES).map(type => (
            <div key={type} className="flex bg-surface-2 border border-border rounded-lg overflow-hidden group hover:border-brand/30 transition-all">
              <div className="px-3 py-2 border-r border-border text-[10px] font-bold text-text-muted flex items-center gap-2">
                <Icon icon={CONTENT_TYPES[type].icon} />
                {CONTENT_TYPES[type].label}
              </div>
              <button
                onClick={() => downloadTemplate(type)}
                className="px-3 py-2 hover:bg-brand/10 hover:text-brand text-text-muted transition-all border-r border-border"
                title="Download .xlsx"
              >
                <Icon icon="solar:file-download-linear" />
              </button>
              <button
                onClick={() => downloadTemplateMd(type)}
                className="px-3 py-2 hover:bg-brand/10 hover:text-brand text-text-muted transition-all"
                title="Download .md"
              >
                <Icon icon="solar:document-text-linear" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-cal p-6 space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">1. Select Content Type</label>
              <div className="space-y-2">
                {Object.keys(CONTENT_TYPES).map(type => (
                  <button
                    key={type}
                    onClick={() => { setSelectedType(type); setFileData([]); setImportResults(null); }}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all ${
                      selectedType === type 
                        ? 'bg-brand/10 border-brand text-brand shadow-lg shadow-brand/10' 
                        : 'bg-surface-2 border-border text-text-muted hover:border-brand/30'
                    }`}
                  >
                    <Icon icon={CONTENT_TYPES[type].icon} className="text-xl" />
                    <span className="font-bold text-sm">{CONTENT_TYPES[type].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">2. Upload Excel File</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-brand/50 hover:bg-brand/5 transition-all group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls"
                  className="hidden" 
                />
                <Icon icon="solar:upload-minimalistic-linear" className="text-4xl text-text-muted mx-auto mb-4 group-hover:scale-110 group-hover:text-brand transition-all" />
                <p className="text-xs font-bold text-text-primary mb-1">Click to browse</p>
                <p className="text-[9px] text-text-muted">Supports .xlsx and .xls</p>
              </div>
            </div>

            {fileData.length > 0 && (
              <button
                onClick={executeImport}
                disabled={isProcessing}
                className="w-full bg-brand text-white font-black py-4 rounded-xl shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Icon icon="solar:rocket-linear" className="text-xl" />
                )}
                Initialize Import ({fileData.length} Records)
              </button>
            )}
          </div>
        </div>

        {/* Right: Results / Preview */}
        <div className="lg:col-span-2">
          {!importResults && fileData.length === 0 && (
            <div className="h-full min-h-[400px] card-cal flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="w-24 h-24 rounded-full bg-surface-2 flex items-center justify-center text-4xl opacity-20">📊</div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-text-primary">Ready for Data Ingestion</h3>
                <p className="text-text-muted text-sm max-w-sm mx-auto leading-relaxed">
                  Select a content type, download the corresponding template, and upload your populated Excel file to begin.
                </p>
              </div>
            </div>
          )}

          {fileData.length > 0 && !isProcessing && (
            <div className="card-cal overflow-hidden">
              <div className="p-4 border-b border-border bg-surface-2/50 flex items-center justify-between">
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest italic">In-Memory Buffer Preview</span>
                <span className="text-[10px] font-bold text-brand bg-brand/10 px-3 py-1 rounded-full">{fileData.length} Rows Detected</span>
              </div>
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface sticky top-0 z-10 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase tracking-widest text-text-muted">Row</th>
                      {CONTENT_TYPES[selectedType].required.map(h => (
                        <th key={h} className="px-6 py-4 font-black uppercase tracking-widest text-brand">{h}*</th>
                      ))}
                      <th className="px-6 py-4 font-black uppercase tracking-widest text-text-muted">Other Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fileData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-surface-2 transition-colors">
                        <td className="px-6 py-4 text-text-muted font-mono">{i + 1}</td>
                        {CONTENT_TYPES[selectedType].required.map(h => (
                          <td key={h} className={`px-6 py-4 font-bold ${row[h] ? 'text-text-primary' : 'text-red-500'}`}>
                            {row[h] || 'MISSING'}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-text-muted italic truncate max-w-[200px]">
                          {Object.keys(row).length - CONTENT_TYPES[selectedType].required.length} additional fields
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fileData.length > 10 && (
                  <div className="p-6 text-center text-[10px] font-bold text-text-muted uppercase border-t border-border bg-surface-2/20">
                    Showing first 10 rows of {fileData.length}
                  </div>
                )}
              </div>
            </div>
          )}

          {importResults && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="card-cal p-6 border-l-4 border-l-green-500 bg-green-500/5">
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">Successful Integrations</p>
                  <p className="text-3xl font-black text-text-primary">{importResults.success.length}</p>
                </div>
                <div className="card-cal p-6 border-l-4 border-l-red-500 bg-red-500/5">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Failed Records</p>
                  <p className="text-3xl font-black text-text-primary">{importResults.failed.length}</p>
                </div>
              </div>

              {/* Failure Report */}
              {importResults.failed.length > 0 && (
                <div className="card-cal overflow-hidden border-red-500/20">
                  <div className="p-4 bg-red-500/10 border-b border-red-500/20">
                    <h4 className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                      <Icon icon="solar:danger-triangle-linear" />
                      Detailed Error Logs
                    </h4>
                  </div>
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-surface border-b border-border text-text-muted uppercase font-black">
                      <tr>
                        <th className="px-6 py-4">Row</th>
                        <th className="px-6 py-4">Identifier</th>
                        <th className="px-6 py-4">Fault Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importResults.failed.map((fail, i) => (
                        <tr key={i} className="bg-red-500/[0.02]">
                          <td className="px-6 py-4 text-red-500 font-mono">{fail.row}</td>
                          <td className="px-6 py-4 font-bold text-text-primary">{fail.identifier}</td>
                          <td className="px-6 py-4">
                            <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-[10px] font-bold">
                              {fail.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
