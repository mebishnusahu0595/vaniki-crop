import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Edit2,
  HelpCircle,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader';
import { LoadingBlock } from '../components/LoadingBlock';
import { adminApi } from '../utils/api';
import type { Product } from '../types/admin';

interface AdvisorQuestion {
  id: string;
  _id?: string;
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  recommendedProductIds?: Product[] | string[];
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
}

export default function AgriAdvisorPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'questions' | 'rules'>('questions');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdvisorQuestion | null>(null);

  // Form Fields
  const [questionEn, setQuestionEn] = useState('');
  const [questionHi, setQuestionHi] = useState('');
  const [answerEn, setAnswerEn] = useState('');
  const [answerHi, setAnswerHi] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [productSearch, setProductSearch] = useState('');

  // Rules State
  const [rulesText, setRulesText] = useState('');
  const [rulesLoaded, setRulesLoaded] = useState(false);

  // Queries
  const questionsQuery = useQuery({
    queryKey: ['super-admin-advisor-questions'],
    queryFn: () => adminApi.getAdvisorQuestions(),
  });

  const productsQuery = useQuery({
    queryKey: ['super-admin-advisor-products'],
    queryFn: () => adminApi.products({ limit: 100, isActive: true }),
  });

  const { isLoading: isRulesLoading } = useQuery({
    queryKey: ['super-admin-advisor-rules'],
    queryFn: async () => {
      const res = await adminApi.getAdvisorRules();
      if (!rulesLoaded && res) {
        setRulesText(res.advisorRules || '');
        setRulesLoaded(true);
      }
      return res;
    },
  });

  // Mutations
  const createQuestionMutation = useMutation({
    mutationFn: (payload: any) => adminApi.createAdvisorQuestion(payload),
    onSuccess: () => {
      toast.success('Suggested Question created successfully');
      queryClient.invalidateQueries({ queryKey: ['super-admin-advisor-questions'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to create question');
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      adminApi.updateAdvisorQuestion(id, payload),
    onSuccess: () => {
      toast.success('Suggested Question updated successfully');
      queryClient.invalidateQueries({ queryKey: ['super-admin-advisor-questions'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to update question');
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdvisorQuestion(id),
    onSuccess: () => {
      toast.success('Suggested Question deleted');
      queryClient.invalidateQueries({ queryKey: ['super-admin-advisor-questions'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete question');
    },
  });

  const updateRulesMutation = useMutation({
    mutationFn: (rules: string) => adminApi.updateAdvisorRules(rules),
    onSuccess: () => {
      toast.success('AI Advisor Rules saved successfully');
      queryClient.invalidateQueries({ queryKey: ['super-admin-advisor-rules'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to save rules');
    },
  });

  const openAddModal = () => {
    setEditingQuestion(null);
    setQuestionEn('');
    setQuestionHi('');
    setAnswerEn('');
    setAnswerHi('');
    setSelectedProductIds([]);
    setIsActive(true);
    setSortOrder((questionsQuery.data?.length || 0) + 1);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (q: AdvisorQuestion) => {
    setEditingQuestion(q);
    setQuestionEn(q.questionEn || '');
    setQuestionHi(q.questionHi || '');
    setAnswerEn(q.answerEn || '');
    setAnswerHi(q.answerHi || '');

    const pIds = Array.isArray(q.recommendedProductIds)
      ? q.recommendedProductIds.map((p: any) => (typeof p === 'string' ? p : p.id || p._id))
      : [];
    setSelectedProductIds(pIds);

    setIsActive(q.isActive !== false);
    setSortOrder(q.sortOrder || 0);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingQuestion(null);
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionEn.trim() || !questionHi.trim() || !answerEn.trim() || !answerHi.trim()) {
      toast.error('Please fill both English and Hindi questions and answers.');
      return;
    }

    const payload = {
      questionEn: questionEn.trim(),
      questionHi: questionHi.trim(),
      answerEn: answerEn.trim(),
      answerHi: answerHi.trim(),
      recommendedProductIds: selectedProductIds,
      isActive,
      sortOrder: Number(sortOrder) || 0,
    };

    if (editingQuestion) {
      updateQuestionMutation.mutate({
        id: editingQuestion.id || editingQuestion._id!,
        payload,
      });
    } else {
      createQuestionMutation.mutate(payload);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );
  };

  const allProducts: Product[] = productsQuery.data?.data || [];
  const filteredProducts = allProducts.filter((p) =>
    (p.name || '').toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agri Advisor & AI Crop Doctor"
        subtitle="Manage suggested question chips, verified answers & product recommendations, and custom AI advisory rules."
        action={
          activeTab === 'questions' ? (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-md transition hover:bg-emerald-900 active:scale-95"
            >
              <Plus size={16} />
              Add Suggested Question
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-black transition ${
            activeTab === 'questions'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HelpCircle size={16} />
          Suggested Questions & Curated Answers ({questionsQuery.data?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-black transition ${
            activeTab === 'rules'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot size={16} />
          Advisor AI System Rules & Guidelines
        </button>
      </div>

      {/* Tab 1: Suggested Questions */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {questionsQuery.isLoading ? (
            <LoadingBlock />
          ) : !questionsQuery.data || questionsQuery.data.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-xs">
              <Sparkles className="mx-auto h-12 w-12 text-emerald-600 mb-3" />
              <h3 className="text-lg font-black text-slate-900">No Suggested Questions Yet</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Add preset questions with your verified diagnosis and recommended products. When farmers tap them in the app, your verified answer prints instantly!
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-900"
              >
                <Plus size={14} /> Create First Question
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {questionsQuery.data.map((q: AdvisorQuestion) => {
                const recProducts = (q.recommendedProductIds as any[]) || [];

                return (
                  <div
                    key={q.id || q._id}
                    className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-[280px]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-600">
                            Order #{q.sortOrder}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                              q.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {q.isActive ? 'Active in App' : 'Disabled'}
                          </span>
                        </div>

                        {/* Questions */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded">
                              EN
                            </span>
                            <h4 className="text-base font-black text-slate-900">{q.questionEn}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                              HI
                            </span>
                            <h4 className="text-base font-black text-slate-800">{q.questionHi}</h4>
                          </div>
                        </div>

                        {/* Answers preview */}
                        <div className="mt-3 rounded-2xl bg-slate-50 p-3 border border-slate-100 text-xs text-slate-600 space-y-1.5">
                          <p className="line-clamp-2">
                            <strong className="text-slate-800">Answer (HI):</strong> {q.answerHi}
                          </p>
                          <p className="line-clamp-2">
                            <strong className="text-slate-800">Answer (EN):</strong> {q.answerEn}
                          </p>
                        </div>

                        {/* Recommended Products */}
                        {recProducts.length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Linked Products:
                            </span>
                            {recProducts.map((p: any) => (
                              <span
                                key={p.id || p._id}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-900"
                              >
                                <Package size={12} className="text-emerald-700" />
                                {p.name}
                                {p.dosage ? (
                                  <span className="text-[10px] font-normal text-emerald-700">
                                    ({p.dosage})
                                  </span>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-start">
                        <button
                          onClick={() =>
                            updateQuestionMutation.mutate({
                              id: q.id || q._id!,
                              payload: { isActive: !q.isActive },
                            })
                          }
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          {q.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => openEditModal(q)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this question?')) {
                              deleteQuestionMutation.mutate(q.id || q._id!);
                            }
                          }}
                          className="rounded-xl border border-rose-100 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Advisor System Rules */}
      {activeTab === 'rules' && (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          {isRulesLoading ? (
            <LoadingBlock />
          ) : (
            <>
              <div>
            <h3 className="text-lg font-black text-slate-900">
              AI Crop Doctor Custom Rules & Guidelines (सलाहकार नियम)
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Whatever guidelines you set here are passed directly to the AI Crop Doctor engine. When a farmer asks any freeform question or uploads a photo, the AI will strictly abide by these rules.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-400">Quick Rule Ideas:</span>
            <button
              type="button"
              onClick={() =>
                setRulesText(
                  (prev) =>
                    prev +
                    '\n• Always prioritize organic, bio-pesticide, or bio-stimulant remedies where feasible before suggesting chemical options.',
                )
              }
              className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              + Add Organic Priority Rule
            </button>
            <button
              type="button"
              onClick={() =>
                setRulesText(
                  (prev) =>
                    prev +
                    '\n• Strictly recommend only products from Vaniki Crop database. Never recommend third-party chemical brands.',
                )
              }
              className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              + Strict Brand Exclusivity
            </button>
            <button
              type="button"
              onClick={() =>
                setRulesText(
                  (prev) =>
                    prev +
                    '\n• Keep spray dosage instructions exact, simple, and strictly aligned with the catalog official dosage to prevent crop burning.',
                )
              }
              className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              + Strict Certified Dosage Rule
            </button>
          </div>

          <textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            rows={10}
            placeholder="Write your custom rules here... e.g.:
1. Always suggest exact dosage per acre and per 15-liter pump.
2. Recommend max 2 products per solution to avoid farmer confusion.
3. Be respectful, encouraging, and write in clear farmer-friendly Hindi."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 font-mono text-sm leading-relaxed text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />

          <div className="flex justify-end">
            <button
              disabled={updateRulesMutation.isPending}
              onClick={() => updateRulesMutation.mutate(rulesText)}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-800 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-900 disabled:opacity-50"
            >
              <Save size={16} />
              {updateRulesMutation.isPending ? 'Saving Rules...' : 'Save AI Rules'}
            </button>
          </div>
        </>
      )}
    </div>
  )}

      {/* Modal: Add/Edit Question */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {editingQuestion ? 'Edit Suggested Question' : 'Add Suggested Question'}
                </h3>
                <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                  Preset Question, Verified Answer, and Product Recommendations
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 pt-4">
              {/* Question EN & HI */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Question (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={questionEn}
                    onChange={(e) => setQuestionEn(e.target.value)}
                    placeholder="e.g. Leaf folder & caterpillar in Paddy"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Question (Hindi - प्रश्न हिंदी में) *
                  </label>
                  <input
                    type="text"
                    required
                    value={questionHi}
                    onChange={(e) => setQuestionHi(e.target.value)}
                    placeholder="उदा. धान में पत्ती लपेटक और इल्ली का इलाज"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Answer HI */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-emerald-900">
                  Verified Answer (Hindi - उत्तर हिंदी में) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={answerHi}
                  onChange={(e) => setAnswerHi(e.target.value)}
                  placeholder="उदा. धान में पत्ती लपेटक कीट पत्तियों को लपेटकर अंदर से खा जाता है। इसके प्रभावी नियंत्रण के लिए वनिकी VIVAN-SUPER कीटनाशक 150 मिली प्रति एकड़ की दर से 150-200 लीटर पानी में मिलाकर पत्तियों पर समान छिड़काव करें।"
                  className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3 text-sm leading-relaxed text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Answer EN */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">
                  Verified Answer (English) *
                </label>
                <textarea
                  required
                  rows={4}
                  value={answerEn}
                  onChange={(e) => setAnswerEn(e.target.value)}
                  placeholder="e.g. Leaf folder rolls paddy leaves and scrapes chlorophyll. Apply VIVAN-SUPER at 150ml per acre mixed in 150-200L clean water for complete caterpillar control."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Product Selector */}
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">
                  Select Recommended Products ({selectedProductIds.length} selected)
                </label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search catalog products..."
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium"
                />

                <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 space-y-1">
                  {filteredProducts.slice(0, 30).map((prod) => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    return (
                      <button
                        type="button"
                        key={prod.id}
                        onClick={() => toggleProduct(prod.id)}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                          isSelected
                            ? 'bg-emerald-800 text-white shadow-xs'
                            : 'bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span>{prod.name}</span>
                        {isSelected ? <CheckCircle2 size={14} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settings (Order & Active) */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-600">
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="active-toggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                  />
                  <label htmlFor="active-toggle" className="text-xs font-black text-slate-800">
                    Active in App
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                  className="rounded-2xl bg-emerald-800 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-900 disabled:opacity-50"
                >
                  {editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
