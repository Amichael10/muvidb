import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  fetchCastingProfile,
  saveCastingProfile,
  BODY_TYPE_OPTIONS,
  SKIN_TONE_OPTIONS,
  HAIR_COLOR_OPTIONS,
  EYE_COLOR_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  AVAILABILITY_OPTIONS,
} from '../../lib/castingProfile';

const DEPARTMENTS = [
  { value: 'Acting', label: 'Acting / Screen Talent', icon: 'solar:clapperboard-play-bold' },
  { value: 'Editing', label: 'Editing & Post-Production', icon: 'solar:scissors-bold' },
  { value: 'Costume', label: 'Costume Design & Wardrobe', icon: 'solar:hanger-bold' },
  { value: 'Camera', label: 'Cinematography & Camera', icon: 'solar:videocamera-record-bold' },
  { value: 'Sound', label: 'Sound & Audio Engineering', icon: 'solar:headphones-round-sound-bold' },
  { value: 'Directing', label: 'Directing & Producing', icon: 'solar:play-circle-bold' },
  { value: 'Art', label: 'Art & Production Design', icon: 'solar:palette-bold' },
  { value: 'Writing', label: 'Writing & Screenplay', icon: 'solar:pen-new-square-bold' },
];

export default function PersonCastingSpecsEditor({ personId, personName, knownDepartment }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Department selection
  const [department, setDepartment] = useState('Acting');

  // Specs state
  const [specs, setSpecs] = useState({
    // Actor physical
    height_feet_inches: '',
    height_cm: '',
    body_type: '',
    skin_tone: '',
    hair_color: '',
    eye_color: '',
    distinguishing_features: '',
    playing_age_min: '',
    playing_age_max: '',
    
    // Universal
    location: 'Lagos, Nigeria',
    willing_to_travel: true,
    languages_text: '',
    skills_text: '',
    experience_level: 'Professional',
    availability_status: 'Available for Bookings',
    portfolio_reel_url: '',

    // Crew / Technical tools
    software_tools_text: '',
    equipment_gear_text: '',
    craft_specializations_text: '',
  });

  useEffect(() => {
    if (!personId) return;
    setLoading(true);

    // Initial guess based on knownDepartment if available
    if (knownDepartment) {
      const match = DEPARTMENTS.find(d => 
        knownDepartment.toLowerCase().includes(d.value.toLowerCase()) || 
        d.value.toLowerCase().includes(knownDepartment.toLowerCase())
      );
      if (match) setDepartment(match.value);
    }

    fetchCastingProfile(personId).then((cp) => {
      if (cp) {
        if (cp.department) setDepartment(cp.department);
        setSpecs((prev) => ({
          ...prev,
          height_feet_inches: cp.height_feet_inches || '',
          height_cm: cp.height_cm || '',
          body_type: cp.body_type || '',
          skin_tone: cp.skin_tone || '',
          hair_color: cp.hair_color || '',
          eye_color: cp.eye_color || '',
          distinguishing_features: cp.distinguishing_features || '',
          playing_age_min: cp.playing_age_min ?? '',
          playing_age_max: cp.playing_age_max ?? '',
          location: cp.location || 'Lagos, Nigeria',
          willing_to_travel: cp.willing_to_travel !== false,
          experience_level: cp.experience_level || 'Professional',
          availability_status: cp.availability_status || 'Available for Bookings',
          portfolio_reel_url: cp.portfolio_reel_url || '',
          languages_text: Array.isArray(cp.languages) ? cp.languages.join(', ') : '',
          skills_text: Array.isArray(cp.skills) ? cp.skills.join(', ') : '',
          software_tools_text: Array.isArray(cp.software_tools) ? cp.software_tools.join(', ') : '',
          equipment_gear_text: Array.isArray(cp.equipment_gear) ? cp.equipment_gear.join(', ') : '',
          craft_specializations_text: Array.isArray(cp.craft_specializations) ? cp.craft_specializations.join(', ') : '',
        }));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [personId, knownDepartment]);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!personId) return;

    setSaving(true);
    try {
      const payload = {
        department,
        height_feet_inches: specs.height_feet_inches || null,
        height_cm: specs.height_cm ? Number(specs.height_cm) : null,
        body_type: specs.body_type || null,
        skin_tone: specs.skin_tone || null,
        hair_color: specs.hair_color || null,
        eye_color: specs.eye_color || null,
        distinguishing_features: specs.distinguishing_features || null,
        playing_age_min: specs.playing_age_min ? Number(specs.playing_age_min) : null,
        playing_age_max: specs.playing_age_max ? Number(specs.playing_age_max) : null,
        location: specs.location || 'Lagos, Nigeria',
        willing_to_travel: specs.willing_to_travel !== false,
        experience_level: specs.experience_level || 'Professional',
        availability_status: specs.availability_status || 'Available for Bookings',
        portfolio_reel_url: specs.portfolio_reel_url || null,
        languages: specs.languages_text.split(',').map((s) => s.trim()).filter(Boolean),
        skills: specs.skills_text.split(',').map((s) => s.trim()).filter(Boolean),
        software_tools: specs.software_tools_text.split(',').map((s) => s.trim()).filter(Boolean),
        equipment_gear: specs.equipment_gear_text.split(',').map((s) => s.trim()).filter(Boolean),
        craft_specializations: specs.craft_specializations_text.split(',').map((s) => s.trim()).filter(Boolean),
      };

      const res = await saveCastingProfile(personId, payload);
      if (res.ok) {
        toast.success(`Industry specs & skills saved for ${personName || 'person'}!`);
      } else {
        toast.error('Failed to save specs: ' + (res.error?.message || res.error || 'Unknown error'));
      }
    } catch (err) {
      toast.error('Error saving industry specs: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-xs text-text-muted">
        <Icon icon="solar:spinner-line-duotone" className="animate-spin text-brand mr-2" width="18" />
        Loading industry & casting specs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5 text-xs text-text-secondary">
        <p className="font-bold text-white flex items-center gap-1.5">
          <Icon icon="solar:shield-check-bold" className="text-brand" width="16" />
          Zero-Falsification Industry Dossier
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
          Only add specs and skills verified directly from the creative's official portfolio, agency agency sheet, or claimed dossier. Leave empty if unconfirmed.
        </p>
      </div>

      {/* Discipline / Department Selector */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
          Professional Discipline / Department
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DEPARTMENTS.map((dept) => {
            const isSelected = department === dept.value;
            return (
              <button
                key={dept.value}
                type="button"
                onClick={() => setDepartment(dept.value)}
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all text-left border ${
                  isSelected
                    ? 'border-brand bg-brand/10 text-brand shadow-sm shadow-brand/10'
                    : 'border-border bg-surface-2 text-text-muted hover:border-border-subtle hover:text-white'
                }`}
              >
                <Icon icon={dept.icon} width="16" className="flex-shrink-0" />
                <span className="truncate">{dept.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTOR CASTING SPECS (When Acting is selected) */}
      {department === 'Acting' && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Icon icon="solar:ruler-bold" className="text-brand" width="16" />
            Physical Attributes & Build (Talent Casting)
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="text-[11px] font-bold text-text-muted">Height (Feet & Inches)</span>
              <input
                type="text"
                value={specs.height_feet_inches}
                placeholder="e.g. 5' 9&quot;"
                onChange={(e) => setSpecs({ ...specs, height_feet_inches: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Height (cm)</span>
              <input
                type="number"
                value={specs.height_cm}
                placeholder="e.g. 175"
                onChange={(e) => setSpecs({ ...specs, height_cm: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Body Type</span>
              <select
                value={specs.body_type}
                onChange={(e) => setSpecs({ ...specs, body_type: e.target.value })}
                className={fieldClass}
              >
                <option value="">Select body type</option>
                {BODY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Skin Tone</span>
              <select
                value={specs.skin_tone}
                onChange={(e) => setSpecs({ ...specs, skin_tone: e.target.value })}
                className={fieldClass}
              >
                <option value="">Select skin tone</option>
                {SKIN_TONE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Eye Color</span>
              <select
                value={specs.eye_color}
                onChange={(e) => setSpecs({ ...specs, eye_color: e.target.value })}
                className={fieldClass}
              >
                <option value="">Select eye color</option>
                {EYE_COLOR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Hair Color</span>
              <select
                value={specs.hair_color}
                onChange={(e) => setSpecs({ ...specs, hair_color: e.target.value })}
                className={fieldClass}
              >
                <option value="">Select hair color</option>
                {HAIR_COLOR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <label>
              <span className="text-[11px] font-bold text-text-muted">Playing Age (Min - Max)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min (e.g. 18)"
                  value={specs.playing_age_min}
                  onChange={(e) => setSpecs({ ...specs, playing_age_min: e.target.value })}
                  className={fieldClass}
                />
                <span className="text-text-muted text-xs">to</span>
                <input
                  type="number"
                  placeholder="Max (e.g. 30)"
                  value={specs.playing_age_max}
                  onChange={(e) => setSpecs({ ...specs, playing_age_max: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Distinguishing Features</span>
              <input
                type="text"
                placeholder="e.g. Left cheek dimple, athletic posture"
                value={specs.distinguishing_features}
                onChange={(e) => setSpecs({ ...specs, distinguishing_features: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {/* EDITING & POST-PRODUCTION CRAFT SPECS */}
      {department === 'Editing' && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Icon icon="solar:scissors-bold" className="text-brand" width="16" />
            Editing Suites, NLEs & Post-Production Proficiencies
          </h4>
          <div className="grid gap-3">
            <label>
              <span className="text-[11px] font-bold text-text-muted">Editing Suites & Software (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. DaVinci Resolve Studio, Adobe Premiere Pro, Avid Media Composer, Final Cut Pro, After Effects"
                value={specs.software_tools_text}
                onChange={(e) => setSpecs({ ...specs, software_tools_text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Craft Specializations (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Feature Film Offline Assembly, Color Grading / DI, Multi-Cam Concerts, VFX Conforming, Sound Design Sync"
                value={specs.craft_specializations_text}
                onChange={(e) => setSpecs({ ...specs, craft_specializations_text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Hardware / Workstation Setup</span>
              <input
                type="text"
                placeholder="e.g. M3 Max 128GB, calibrated EIZO ColorEdge 4K display, Blackmagic Mini Panel, 10GbE NAS"
                value={specs.equipment_gear_text}
                onChange={(e) => setSpecs({ ...specs, equipment_gear_text: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {/* COSTUME & WARDROBE DESIGN CRAFT SPECS */}
      {department === 'Costume' && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Icon icon="solar:hanger-bold" className="text-brand" width="16" />
            Costume Design, Styling & Wardrobe Kit Specs
          </h4>
          <div className="grid gap-3">
            <label>
              <span className="text-[11px] font-bold text-text-muted">Costume & Period Specializations (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Indigenous Yoruba / Igbo / Hausa Regalia, Historical Period Costume, Contemporary High Fashion, Fantasy & SFX"
                value={specs.craft_specializations_text}
                onChange={(e) => setSpecs({ ...specs, craft_specializations_text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Technical Wardrobe Skills (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Textile Distressing & Breakdown, Pattern Drafting, Indigenous Dyeing / Aso-Oke Sourcing, Continuity Kits"
                value={specs.skills_text}
                onChange={(e) => setSpecs({ ...specs, skills_text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Wardrobe Equipment & Mobile Kit</span>
              <input
                type="text"
                placeholder="e.g. Commercial steam stations, full mobile onset tailoring kit, fitting & alteration station"
                value={specs.equipment_gear_text}
                onChange={(e) => setSpecs({ ...specs, equipment_gear_text: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {/* CAMERA & CINEMATOGRAPHY CRAFT SPECS */}
      {department === 'Camera' && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Icon icon="solar:videocamera-record-bold" className="text-brand" width="16" />
            Camera Systems, Rigging & Cinematography Kit
          </h4>
          <div className="grid gap-3">
            <label>
              <span className="text-[11px] font-bold text-text-muted">Owned / Preferred Camera Packages (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. ARRI Alexa Mini LF, RED V-Raptor, Sony FX6 / FX9, Blackmagic 6K Pro"
                value={specs.equipment_gear_text}
                onChange={(e) => setSpecs({ ...specs, equipment_gear_text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Lensing & Motion Specializations (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Anamorphic Glass, Steadicam / Ronin 2 Gimbal, Drone / Aerial Cinematography, High-Speed Lighting"
                value={specs.craft_specializations_text}
                onChange={(e) => setSpecs({ ...specs, craft_specializations_text: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {/* SOUND & AUDIO CRAFT SPECS */}
      {department === 'Sound' && (
        <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <Icon icon="solar:headphones-round-sound-bold" className="text-brand" width="16" />
            Sound Recording Packages, DAWs & Audio Engineering
          </h4>
          <div className="grid gap-3">
            <label>
              <span className="text-[11px] font-bold text-text-muted">DAWs & Post Software (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Pro Tools Ultimate, iZotope RX Advanced, Logic Pro, Soundminer"
                value={specs.software_tools_text}
                onChange={(e) => setSpecs({ ...specs, software_tools_text: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-bold text-text-muted">Audio Equipment & Field Kits (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Sound Devices 833, Schoeps CMIT 5U, Wisycom / Lectrosonics wireless lavs, Sennheiser MKH 416"
                value={specs.equipment_gear_text}
                onChange={(e) => setSpecs({ ...specs, equipment_gear_text: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
        </div>
      )}

      {/* UNIVERSAL EMPLOYABILITY FIELDS (All Departments) */}
      <div className="space-y-4 rounded-xl border border-border/60 bg-surface-1 p-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
          <Icon icon="solar:briefcase-bold" className="text-brand" width="16" />
          Industry Employability, Languages & Availability
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] font-bold text-text-muted">Experience Level</span>
            <select
              value={specs.experience_level}
              onChange={(e) => setSpecs({ ...specs, experience_level: e.target.value })}
              className={fieldClass}
            >
              {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[11px] font-bold text-text-muted">Current Availability</span>
            <select
              value={specs.availability_status}
              onChange={(e) => setSpecs({ ...specs, availability_status: e.target.value })}
              className={fieldClass}
            >
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-[11px] font-bold text-text-muted">Primary Location Base</span>
            <input
              type="text"
              placeholder="e.g. Lagos, Nigeria"
              value={specs.location}
              onChange={(e) => setSpecs({ ...specs, location: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label>
            <span className="text-[11px] font-bold text-text-muted">Showreel / Portfolio URL</span>
            <input
              type="url"
              placeholder="https://vimeo.com/... or portfolio site"
              value={specs.portfolio_reel_url}
              onChange={(e) => setSpecs({ ...specs, portfolio_reel_url: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-[11px] font-bold text-text-muted">Spoken Languages & Accents (Comma-separated)</span>
            <input
              type="text"
              placeholder="e.g. English, Yoruba, Nigerian Pidgin, French (Conversational)"
              value={specs.languages_text}
              onChange={(e) => setSpecs({ ...specs, languages_text: e.target.value })}
              className={fieldClass}
            />
          </label>
          {department === 'Acting' && (
            <label className="sm:col-span-2">
              <span className="text-[11px] font-bold text-text-muted">Performance & Physical Skills (Comma-separated)</span>
              <input
                type="text"
                placeholder="e.g. Stage Combat, Djembe Drumming, Swimming, Stunts, Driving"
                value={specs.skills_text}
                onChange={(e) => setSpecs({ ...specs, skills_text: e.target.value })}
                className={fieldClass}
              />
            </label>
          )}
          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="travel_check"
              checked={specs.willing_to_travel}
              onChange={(e) => setSpecs({ ...specs, willing_to_travel: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-surface-2 text-brand focus:ring-brand/20"
            />
            <label htmlFor="travel_check" className="text-xs text-text-primary font-medium cursor-pointer">
              Willing to travel for domestic and international productions
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-3 text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Icon icon="solar:spinner-line-duotone" className="animate-spin" width="16" />
              Saving Industry Specs...
            </>
          ) : (
            <>
              <Icon icon="solar:diskette-bold" width="16" />
              Save Industry Specs & Skills
            </>
          )}
        </button>
      </div>
    </div>
  );
}
