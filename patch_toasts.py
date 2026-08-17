import re

file_path = 'frontend/src/app/outlet/products/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Import toast and Toaster
if 'react-hot-toast' not in content:
    content = content.replace(
        'import { fetchWithCSRF } from "@/lib/csrf";',
        'import { fetchWithCSRF } from "@/lib/csrf";\nimport toast, { Toaster } from "react-hot-toast";'
    )

# Add Toaster to JSX
if '<Toaster position="bottom-right" />' not in content:
    content = content.replace(
        '<div className="min-h-screen bg-[#faf9f6] flex">',
        '<div className="min-h-screen bg-[#faf9f6] flex">\n      <Toaster position="bottom-right" />'
    )

# Replace handleCreateProduct
content = re.sub(
    r'setIsAddingProduct\(false\);\n\s*fetchProducts\(\);\n\s*\} catch \(err\) \{ console\.error\(err\); \}',
    'setIsAddingProduct(false);\n      fetchProducts();\n      toast.success(`Product Added Successfully\\nProduct: ${formName}`);\n    } catch (err: any) { console.error(err); toast.error("Failed to add product"); }',
    content
)

# Replace handleCreateCategory
content = re.sub(
    r'setIsAddingCategory\(false\);\n\s*fetchProducts\(\);\n\s*\} catch \(err\) \{ console\.error\(err\); \}',
    'setIsAddingCategory(false);\n      fetchProducts();\n      toast.success(`Category Added Successfully\\nCategory: ${formName}`);\n    } catch (err: any) { console.error(err); toast.error("Failed to add category"); }',
    content
)

# Replace handleEditProduct
content = re.sub(
    r'setEditingProduct\(null\);\n\s*fetchProducts\(\);\n\s*\} catch \(err\) \{ console\.error\(err\); \}',
    'setEditingProduct(null);\n      fetchProducts();\n      toast.success(`Product Updated Successfully`);\n    } catch (err: any) { console.error(err); toast.error("Failed to update product"); }',
    content
)

# Replace toggleAvailability
content = re.sub(
    r'fetchProducts\(\);\n\s*\} catch \(e\) \{',
    'fetchProducts();\n      toast.success("Availability changed");\n    } catch (e: any) { toast.error("Failed to change availability");',
    content
)

with open(file_path, 'w') as f:
    f.write(content)

print("Toasts patched successfully.")
