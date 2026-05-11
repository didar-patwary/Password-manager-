import React, { useState, FormEvent } from 'react';
import { SchemaDefinition, FieldDefinition } from '../types';
import { Settings, Plus, BookOpen, Trash2, Check, ArrowRight } from 'lucide-react';

interface SchemaBuilderProps {
  schemas: SchemaDefinition[];
  onAddSchema: (schema: SchemaDefinition) => void;
  onRemoveSchema: (schemaId: string) => void;
}

export default function SchemaBuilder({ schemas, onAddSchema, onRemoveSchema }: SchemaBuilderProps) {
  const [newSchemaName, setNewSchemaName] = useState('');
  const [newSchemaDesc, setNewSchemaDesc] = useState('');
  const [fields, setFields] = useState<FieldDefinition[]>([
    { name: 'name', type: 'string', required: true }
  ]);

  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<'string' | 'number' | 'boolean' | 'array'>('string');
  const [fieldRequired, setFieldRequired] = useState(true);

  const handleAddField = () => {
    const fName = fieldName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!fName) return;
    if (fields.some(p => p.name === fName)) return;

    setFields(prev => [...prev, {
      name: fName,
      type: fieldType,
      required: fieldRequired,
      defaultValue: fieldType === 'array' ? [] : fieldType === 'boolean' ? false : undefined
    }]);

    setFieldName('');
    setFieldType('string');
    setFieldRequired(true);
  };

  const handleRemoveField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateSchema = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSchemaName.trim();
    if (!name || fields.length === 0) return;

    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (schemas.some(s => s.id === id)) return;

    const newSchema: SchemaDefinition = {
      id,
      name,
      description: newSchemaDesc.trim() || `Custom offline entity ${name}`,
      fields
    };

    onAddSchema(newSchema);

    // Reset Form
    setNewSchemaName('');
    setNewSchemaDesc('');
    setFields([{ name: 'name', type: 'string', required: true }]);
  };

  return (
    <div id="schema-designer-panel" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl relative z-10 animate-fade-in">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Settings className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold tracking-wider text-white uppercase font-sans">
          Dynamic Schema Architect
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Tables / Schemas List */}
        <div className="space-y-4">
          <span className="text-xs text-slate-450 font-mono font-bold uppercase tracking-widest block">
            Active Database Collections
          </span>
          <div className="space-y-3.5 max-h-[300px] overflow-y-auto">
            {schemas.map((schema) => (
              <div 
                key={schema.id} 
                className="bg-black/20 border border-white/5 rounded-2xl p-4 relative hover:border-white/10 transition-colors duration-200 shadow-md"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-100 uppercase font-mono tracking-wide">
                      {schema.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">/collection/{schema.id}</span>
                  </div>
                  {/* Prevent deleting default schemas for safety */}
                  {!['tasks', 'notes', 'contacts'].includes(schema.id) && (
                    <button
                      type="button"
                      id={`delete-schema-${schema.id}`}
                      onClick={() => onRemoveSchema(schema.id)}
                      className="text-slate-400 hover:text-red-400 p-1.5 rounded-xl transition bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans mb-3.5">{schema.description}</p>
                
                {/* Field Tags */}
                <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                  {schema.fields.map((field) => (
                    <span 
                      key={field.name} 
                      className="bg-black/30 px-2 py-0.5 rounded-lg text-[9px] font-mono border border-white/5 flex items-center gap-1.5 text-slate-350"
                    >
                      {field.name}
                      <span className="text-[8px] text-blue-400 underline font-semibold uppercase">{field.type}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Schema Card Form */}
        <form onSubmit={handleCreateSchema} className="bg-black/25 backdrop-blur-md border border-white/5 rounded-2xl p-5 space-y-4.5 shadow-lg">
          <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1">
            <Plus className="w-4 h-4 text-emerald-400" /> Create Custom Collection
          </span>

          <div className="space-y-3.5">
            <div>
              <label htmlFor="schema-name-input" className="text-[10px] uppercase font-mono text-slate-500 font-semibold block mb-1">
                Collection Name
              </label>
              <input
                id="schema-name-input"
                type="text"
                placeholder="e.g. Invoices, Repositories..."
                required
                className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 font-mono uppercase"
                value={newSchemaName}
                onChange={e => setNewSchemaName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="schema-desc-input" className="text-[10px] uppercase font-mono text-slate-500 font-semibold block mb-1">
                Description
              </label>
              <input
                id="schema-desc-input"
                type="text"
                placeholder="Describe what these items store..."
                className="w-full text-xs bg-black/35 border border-white/10 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50"
                value={newSchemaDesc}
                onChange={e => setNewSchemaDesc(e.target.value)}
              />
            </div>
          </div>

          {/* Builder Field Column */}
          <div className="border-t border-white/5 pt-4 space-y-3">
            <label className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
              Configure Fields ({fields.length} added)
            </label>

            {/* In-memory fields accumulator listing */}
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto bg-black/40 p-2.5 rounded-xl border border-white/5">
              {fields.map((field, idx) => (
                <div 
                  key={field.name + idx} 
                  className="bg-white/5 px-2 py-0.5 rounded-lg text-[10px] font-mono border border-white/5 flex items-center gap-1.5 text-slate-200"
                >
                  <span>{field.name}:<span className="text-blue-405 text-sky-400 font-bold">{field.type}</span></span>
                  <button 
                    type="button" 
                    id={`remove-field-btn-${idx}`}
                    onClick={() => handleRemoveField(idx)}
                    className="text-slate-550 hover:text-red-400 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
              {fields.length === 0 && (
                <span className="text-[9px] text-slate-605 italic">No custom fields defined yet</span>
              )}
            </div>

            {/* Field adding widget */}
            <div className="bg-black/35 p-3 rounded-2xl border border-white/5 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="field-name-input" className="text-[8px] font-mono uppercase text-slate-500 block mb-0.5">Name</label>
                  <input
                    id="field-name-input"
                    type="text"
                    placeholder="e.g. price, tags"
                    className="w-full text-[10px] font-mono bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50"
                    value={fieldName}
                    onChange={e => setFieldName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="field-type-select" className="text-[8px] font-mono uppercase text-slate-500 block mb-0.5">Type</label>
                  <select
                    id="field-type-select"
                    className="w-full text-[10px] font-mono bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none"
                    value={fieldType}
                    onChange={e => setFieldType(e.target.value as any)}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={e => setFieldRequired(e.target.checked)}
                    className="form-checkbox h-3.5 w-3.5 text-blue-600 rounded-lg border-white/10 bg-black/35"
                  />
                  Required
                </label>
                <button
                  type="button"
                  id="add-field-acc-btn"
                  onClick={handleAddField}
                  className="bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 font-mono font-bold px-3 py-1 rounded-xl text-[9px] flex items-center gap-1.5 transition-colors border border-blue-500/15 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Field
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="register-custom-schema-btn"
            disabled={fields.length === 0 || !newSchemaName}
            className="w-full text-xs font-sans font-bold uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 border border-blue-500/10 hover:border-blue-500/20 py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-blue-550/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Table <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
