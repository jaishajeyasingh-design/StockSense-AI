import React from 'react';
import StockAlert from './StockAlert';
import { Edit2, Trash2 } from 'lucide-react';

const ProductTable = ({
  products = [],
  onEdit,
  onDelete,
  userRole = 'STAFF',
}) => {
  const canEdit = userRole === 'ADMIN' || userRole === 'MANAGER';
  const canDelete = userRole === 'ADMIN';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <th className="py-3.5 px-4">Product</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Price</th>
              <th className="py-3.5 px-4">Current Stock</th>
              <th className="py-3.5 px-4">Reorder Level</th>
              <th className="py-3.5 px-4">Status</th>
              {(canEdit || canDelete) && <th className="py-3.5 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-400">
                  No products found. Add products or adjust filters.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-800">{product.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-medium">
                      {product.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">₹{product.price}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{product.stock}</td>
                  <td className="py-3.5 px-4 text-slate-500">{product.reorderLevel}</td>
                  <td className="py-3.5 px-4">
                    <StockAlert status={product.calculatedStatus || 'HEALTHY'} />
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {canEdit && (
                        <button
                          onClick={() => onEdit(product)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDelete(product._id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductTable;
