import { useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import * as Icons from "lucide-react";
import Accordion from "../ui/Accordion";

export default function LessonEditor({ initialData, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    topic: "",
    difficulty: "Beginner",
    estimatedTime: "3 min",
    order: 0,
    isPublished: false,
    ...initialData,
    steps: {
      intro: { tagline: "", objectives: [], ...(initialData?.steps?.intro || {}) },
      understand: { title: "", concept: "", points: [], ...(initialData?.steps?.understand || {}) },
      seeIt: { example: "", sender: "", redFlags: [], ...(initialData?.steps?.seeIt || {}) },
      tryItYourself: { example: "", sender: "", redFlags: [], ...(initialData?.steps?.tryItYourself || {}) },
      realWorld: { scenario: "", options: [], ...(initialData?.steps?.realWorld || {}) },
      quiz: initialData?.steps?.quiz || [],
      takeaway: { title: "", summary: "", points: [], ...(initialData?.steps?.takeaway || {}) },
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleStepChange = (step, field, value) => {
    setFormData(prev => ({
      ...prev,
      steps: {
        ...prev.steps,
        [step]: { ...prev.steps[step], [field]: value }
      }
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-ink">{initialData?._id ? "Edit Lesson" : "Create Lesson"}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onSave(formData)}>Save Lesson</Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
          <Input label="Title" name="title" value={formData.title} onChange={handleChange} required />
          <Input label="Slug (Unique URL)" name="slug" value={formData.slug} onChange={handleChange} required />
          <Input label="Category (Topic)" name="topic" value={formData.topic} onChange={handleChange} required />
          
          <div>
            <label className="block text-sm font-medium text-ink-light mb-1">Difficulty</label>
            <select name="difficulty" value={formData.difficulty} onChange={handleChange} className="w-full h-11 px-4 border border-slate-200 rounded-xl bg-white outline-none focus:border-primary">
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          
          <Input label="Estimated Time" name="estimatedTime" value={formData.estimatedTime} onChange={handleChange} />
          <Input label="Order" name="order" type="number" value={formData.order} onChange={handleChange} />
          
          <label className="flex items-center gap-2 mt-6 cursor-pointer">
            <input type="checkbox" name="isPublished" checked={formData.isPublished} onChange={handleChange} className="w-5 h-5 rounded text-primary border-slate-300" />
            <span className="font-medium">Published</span>
          </label>
        </div>

        {/* Steps Editor - Simplified representation for CMS */}
        <h3 className="text-lg font-bold text-ink border-b pb-2 mt-8">Lesson Content (Steps)</h3>
        
        <div className="space-y-3">
          <Accordion title="1. Intro">
            <div className="p-4 space-y-4">
              <Input label="Tagline" value={formData.steps.intro.tagline} onChange={(e) => handleStepChange('intro', 'tagline', e.target.value)} />
              {/* Note: Array editing (objectives) simplified for brevity in this CMS iteration */}
              <div className="text-xs text-ink-faint italic">Note: Advanced array editing (objectives) is managed directly via JSON/DB in this version.</div>
            </div>
          </Accordion>

          <Accordion title="2. Understand">
            <div className="p-4 space-y-4">
              <Input label="Title" value={formData.steps.understand.title} onChange={(e) => handleStepChange('understand', 'title', e.target.value)} />
              <Input label="Key Concept" value={formData.steps.understand.concept} onChange={(e) => handleStepChange('understand', 'concept', e.target.value)} />
            </div>
          </Accordion>

          <Accordion title="3. See It (Example)">
            <div className="p-4 space-y-4">
              <Input label="Sender" value={formData.steps.seeIt.sender} onChange={(e) => handleStepChange('seeIt', 'sender', e.target.value)} />
              <textarea 
                placeholder="Example Message Content..."
                className="w-full p-4 border border-slate-200 rounded-xl"
                rows={4}
                value={formData.steps.seeIt.example} 
                onChange={(e) => handleStepChange('seeIt', 'example', e.target.value)} 
              />
            </div>
          </Accordion>
          
          <Accordion title="4. Try It Yourself">
            <div className="p-4 space-y-4">
              <Input label="Sender" value={formData.steps.tryItYourself.sender} onChange={(e) => handleStepChange('tryItYourself', 'sender', e.target.value)} />
              <textarea 
                placeholder="Interactive Example Message Content..."
                className="w-full p-4 border border-slate-200 rounded-xl"
                rows={4}
                value={formData.steps.tryItYourself.example} 
                onChange={(e) => handleStepChange('tryItYourself', 'example', e.target.value)} 
              />
            </div>
          </Accordion>

          <Accordion title="5. Real World & 6. Quiz & 7. Takeaway">
            <div className="p-4">
              <p className="text-sm text-ink-light">
                These advanced interactive modules (options, multiple choice quizzes, arrays) are currently preserved during edits but full visual array builders are scheduled for the next iteration. 
              </p>
            </div>
          </Accordion>
        </div>

        <div className="pt-6 flex justify-end">
          <Button onClick={() => onSave(formData)} size="lg" icon={Icons.Save}>Save Lesson</Button>
        </div>
      </div>
    </div>
  );
}
