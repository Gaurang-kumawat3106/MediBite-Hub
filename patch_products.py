import re

file_path = 'frontend/src/app/outlet/products/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Add states
if 'isAddingProduct' not in content:
    content = content.replace(
        'const [loading, setLoading] = useState(true);',
        'const [loading, setLoading] = useState(true);\n  const [isAddingProduct, setIsAddingProduct] = useState(false);\n  const [isAddingCategory, setIsAddingCategory] = useState(false);\n  const [editingProduct, setEditingProduct] = useState<any>(null);\n  const [formName, setFormName] = useState("");\n  const [formPrice, setFormPrice] = useState("");\n  const [formCategory, setFormCategory] = useState("");\n  const [formImage, setFormImage] = useState<File | null>(null);'
    )

# Add save handlers
if 'handleCreateProduct' not in content:
    handlers = """
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", formName);
      formData.append("price", formPrice);
      formData.append("category", formCategory);
      if (formImage) formData.append("image", formImage);
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/add-product/`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      setIsAddingProduct(false);
      fetchProducts();
    } catch (err) { console.error(err); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new URLSearchParams();
      formData.append("name", formName);
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/add-category/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include"
      });
      setIsAddingCategory(false);
      fetchProducts();
    } catch (err) { console.error(err); }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", formName);
      formData.append("price", formPrice);
      formData.append("category", formCategory);
      if (formImage) formData.append("image", formImage);
      await fetchWithCSRF(`${process.env.NEXT_PUBLIC_API_URL}/app/outlet/product/${editingProduct.id}/edit/`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      setEditingProduct(null);
      fetchProducts();
    } catch (err) { console.error(err); }
  };
"""
    content = content.replace(
        'const toggleAvailability = async (productId: number) => {',
        handlers + '\n  const toggleAvailability = async (productId: number) => {'
    )

# Add buttons and Modals
if 'setIsAddingProduct(true)' not in content:
    content = content.replace(
        '<button className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-brand/20 hover:bg-brand-dark transition-colors">\n              + Add Product\n            </button>',
        '<div className="flex gap-4"><button onClick={() => {setFormName(""); setFormPrice(""); setFormCategory(""); setIsAddingProduct(true);}} className="bg-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-brand/20 hover:bg-brand-dark transition-colors">+ Add Product</button><button onClick={() => {setFormName(""); setIsAddingCategory(true);}} className="bg-gray-100 text-[#2b1b10] px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-200 transition-colors">+ Add Category</button></div>'
    )

# Edit product button
if 'setEditingProduct(prod)' not in content:
    content = content.replace(
        '<button className="text-gray-400 hover:text-brand transition-colors p-2">',
        '<button onClick={() => {setEditingProduct(prod); setFormName(prod.name); setFormPrice(prod.price); setFormCategory(cat.id.toString());}} className="text-gray-400 hover:text-brand transition-colors p-2">'
    )

# Add Modal UI at the bottom
if 'Modal Overlays' not in content:
    modals = """
      {/* Modal Overlays */}
      {(isAddingProduct || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-[#2b1b10]">{editingProduct ? "Edit Product" : "Add Product"}</h2>
            <form onSubmit={editingProduct ? handleEditProduct : handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Name</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Price</label>
                <input required type="number" step="0.01" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Category</label>
                <select required className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                  <option value="">Select Category</option>
                  {data?.categories?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Image</label>
                <input type="file" accept="image/*" className="w-full" onChange={(e) => setFormImage(e.target.files?.[0] || null)} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => {setIsAddingProduct(false); setEditingProduct(null);}} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 bg-brand text-white font-bold py-3 rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingCategory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6 text-[#2b1b10]">Add Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">Category Name</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddingCategory(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 bg-brand text-white font-bold py-3 rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
"""
    content = content.replace(
        '</main>\n    </div>',
        '</main>\n' + modals + '\n    </div>'
    )

with open(file_path, 'w') as f:
    f.write(content)

print("Products UI patched successfully.")
