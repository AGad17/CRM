'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { ProductForm } from '@/components/forms/ProductForm'

const COUNTRIES = ['KSA', 'Egypt', 'UAE', 'Bahrain', 'Jordan']
const CURRENCY = { KSA: 'SAR', Egypt: 'EGP', UAE: 'AED', Bahrain: 'BHD', Jordan: 'JOD' }

export default function ProductsPage() {
  const qc = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modal, setModal] = useState(null) // 'create' | { type: 'detail', product }
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [pricingForm, setPricingForm] = useState({ country: 'KSA', price: '', effectiveFrom: '', notes: '' })
  const [pricingErrors, setPricingErrors] = useState({})
  const [activeCountry, setActiveCountry] = useState('KSA')

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  })

  const createProduct = useMutation({
    mutationFn: (data) =>
      fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries(['products']); setModal(null) },
  })

  const updateProduct = useMutation({
    mutationFn: ({ id, ...data }) =>
      fetch(`/api/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: (updated) => {
      qc.invalidateQueries(['products'])
      setSelectedProduct(updated)
    },
  })

  const addPricing = useMutation({
    mutationFn: ({ productId, ...data }) =>
      fetch(`/api/products/${productId}/pricing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: async () => {
      await qc.invalidateQueries(['products'])
      // Refresh selected product from updated list
      const updated = await fetch(`/api/products/${selectedProduct.id}`).then((r) => r.json())
      setSelectedProduct(updated)
      setPricingForm({ country: activeCountry, price: '', effectiveFrom: '', notes: '' })
      setPricingErrors({})
    },
  })

  const deletePricing = useMutation({
    mutationFn: ({ productId, pricingId }) =>
      fetch(`/api/products/${productId}/pricing/${pricingId}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: async () => {
      await qc.invalidateQueries(['products'])
      const updated = await fetch(`/api/products/${selectedProduct.id}`).then((r) => r.json())
      setSelectedProduct(updated)
    },
  })

  const filtered = categoryFilter
    ? products.filter((p) => p.category === categoryFilter)
    : products

  function openDetail(product) {
    setSelectedProduct(product)
    setActiveCountry('KSA')
    setPricingForm({ country: 'KSA', price: '', effectiveFrom: '', notes: '' })
    setPricingErrors({})
    setModal('detail')
  }

  function handleAddPricing(e) {
    e.preventDefault()
    const errs = {}
    if (!pricingForm.price || Number(pricingForm.price) <= 0) errs.price = 'Must be > 0'
    if (!pricingForm.effectiveFrom) errs.effectiveFrom = 'Required'
    if (Object.keys(errs).length) { setPricingErrors(errs); return }
    addPricing.mutate({ productId: selectedProduct.id, country: activeCountry, price: Number(pricingForm.price), effectiveFrom: pricingForm.effectiveFrom, notes: pricingForm.notes || null })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[['', 'All'], ['Plan', 'Plans'], ['AddOn', 'Add-ons']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setCategoryFilter(val)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${categoryFilter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setModal('create')}
          className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          + New Product
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No products yet. Add your first product.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                {COUNTRIES.map((c) => (
                  <th key={c} className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => openDetail(product)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{product.name}</p>
                    {product.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{product.description}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.category === 'Plan' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                      {product.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {COUNTRIES.map((c) => {
                    const entry = product.currentPricing?.[c]
                    return (
                      <td key={c} className="px-4 py-3.5 text-right">
                        {entry ? (
                          <span className="font-mono text-gray-800 text-xs">{CURRENCY[c]} {Number(entry.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="New Product">
        <ProductForm
          onSubmit={(data) => createProduct.mutate(data)}
          onCancel={() => setModal(null)}
          loading={createProduct.isPending}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={modal === 'detail'} onClose={() => setModal(null)} title={selectedProduct?.name || 'Product'}>
        {selectedProduct && (
          <div className="space-y-6">
            {/* Product info edit */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Product Details</h3>
              <ProductForm
                initial={selectedProduct}
                onSubmit={(data) => updateProduct.mutate({ id: selectedProduct.id, ...data })}
                onCancel={() => setModal(null)}
                loading={updateProduct.isPending}
              />
            </div>

            {/* Pricing section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pricing by Country</h3>

              {/* Country tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 flex-wrap">
                {COUNTRIES.map((c) => {
                  const hasCurrent = !!selectedProduct.currentPricing?.[c]
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setActiveCountry(c)
                        setPricingForm({ country: c, price: '', effectiveFrom: '', notes: '' })
                        setPricingErrors({})
                      }}
                      className={`flex-1 min-w-fit px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCountry === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {c}
                      {hasCurrent && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block align-middle" />}
                    </button>
                  )
                })}
              </div>

              {/* History for active country */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 font-medium">Price history — {activeCountry}</p>
                {(selectedProduct.historyByCountry?.[activeCountry] || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No pricing set yet.</p>
                ) : (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Effective From</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Price</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Notes</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(selectedProduct.historyByCountry[activeCountry] || []).map((entry, i) => (
                          <tr key={entry.id} className={i === 0 ? 'bg-emerald-50/50' : ''}>
                            <td className="px-3 py-2 text-gray-700">
                              {new Date(entry.effectiveFrom).toLocaleDateString()}
                              {i === 0 && <span className="ml-1.5 text-emerald-600 font-medium">(current)</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">
                              {entry.currency} {Number(entry.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{entry.notes || '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => deletePricing.mutate({ productId: selectedProduct.id, pricingId: entry.id })}
                                className="text-red-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add price form */}
              <form onSubmit={handleAddPricing} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600">Set new price for {activeCountry}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Price ({CURRENCY[activeCountry]}) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${pricingErrors.price ? 'border-red-400' : 'border-gray-200 focus:border-indigo-400'}`}
                      value={pricingForm.price}
                      onChange={(e) => setPricingForm({ ...pricingForm, price: e.target.value })}
                      placeholder="0.00"
                    />
                    {pricingErrors.price && <p className="text-xs text-red-500 mt-1">{pricingErrors.price}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Effective From *</label>
                    <input
                      type="date"
                      className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${pricingErrors.effectiveFrom ? 'border-red-400' : 'border-gray-200 focus:border-indigo-400'}`}
                      value={pricingForm.effectiveFrom}
                      onChange={(e) => setPricingForm({ ...pricingForm, effectiveFrom: e.target.value })}
                    />
                    {pricingErrors.effectiveFrom && <p className="text-xs text-red-500 mt-1">{pricingErrors.effectiveFrom}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
                    value={pricingForm.notes}
                    onChange={(e) => setPricingForm({ ...pricingForm, notes: e.target.value })}
                    placeholder="e.g. Annual pricing update"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addPricing.isPending}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {addPricing.isPending ? 'Saving…' : `+ Set Price for ${activeCountry}`}
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
