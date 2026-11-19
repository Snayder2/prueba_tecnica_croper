import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { AlertIcon, BoxIcon, ChevronLeftIcon } from '../../components/icons';
import { PriceTag } from '../../components/PriceTag';
import { Spinner } from '../../components/Spinner';
import { buttonClassName, FOCUS_RING } from '../../components/styles';
import { MESSAGES } from '../../utils/errorMessages';
import { formatInteger } from '../../utils/formatters';
import { fetchCatalogProduct } from './catalogSlice';
import { ImageGallery } from './components/ImageGallery';

/** Set by the catalog cards, so "Volver" can go back keeping the filters. */
export interface FromCatalogState {
  fromCatalog?: boolean;
}

/**
 * Product detail (spec 03 §13.6): gallery, name, seller, category, price,
 * availability and description. There is no "Comprar" button in this version.
 */
export function ProductDetailPage() {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { selected, selectedStatus, selectedError } = useAppSelector((state) => state.catalog);
  const product = selected?._id === id ? selected : null;

  useEffect(() => {
    const request = dispatch(fetchCatalogProduct(id));
    return () => request.abort();
  }, [dispatch, id]);

  // Back to the catalog with the same filters: history if we came from it.
  const fromCatalog = (location.state as FromCatalogState | null)?.fromCatalog === true;
  const goBack = () => {
    if (fromCatalog) void navigate(-1);
    else void navigate('/catalog');
  };

  const backLink = (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex min-h-11 items-center gap-1 rounded text-sm font-medium text-brand-700 hover:underline ${FOCUS_RING}`}
    >
      <ChevronLeftIcon className="size-4" />
      Volver al catálogo
    </button>
  );

  if (selectedStatus === 'failed' && !product) {
    const notFound = selectedError?.status === 404 || selectedError?.status === 400;
    return (
      <div className="space-y-4">
        {backLink}
        <EmptyState
          role="alert"
          icon={notFound ? <BoxIcon className="size-7" /> : <AlertIcon className="size-7" />}
          title={notFound ? MESSAGES.productUnavailable : 'No pudimos cargar el producto'}
          description={notFound ? undefined : selectedError?.message}
          action={
            notFound ? (
              <Link to="/catalog" className={buttonClassName('primary')}>
                Ir al catálogo
              </Link>
            ) : (
              <Button onClick={() => void dispatch(fetchCatalogProduct(id))}>Reintentar</Button>
            )
          }
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status">
        <Spinner className="size-8" />
        <span className="sr-only">Cargando el producto…</span>
      </div>
    );
  }

  return (
    <article className="space-y-4" aria-labelledby="product-title">
      {backLink}
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        {/* key: a different product starts the gallery on its main image. */}
        <ImageGallery key={product._id} images={product.images} name={product.name} />

        <div className="space-y-4">
          <div className="space-y-1">
            {product.category && <p className="text-sm text-navy-400">{product.category}</p>}
            <h1 id="product-title" className="text-2xl font-semibold text-navy-500">
              {product.name}
            </h1>
            <p className="text-sm text-navy-400">Vendido por {product.seller.name}</p>
          </div>

          <PriceTag
            layout="inline"
            size="lg"
            price={product.price}
            finalPrice={product.finalPrice}
            discountPercent={product.discountPercent}
          />

          <p
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              product.stock > 0 ? 'bg-leaf-50 text-leaf-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {product.stock > 0
              ? `Disponible · ${formatInteger(product.stock)} ${product.stock === 1 ? 'unidad' : 'unidades'}`
              : 'Agotado'}
          </p>

          {product.description && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-navy-500">Descripción</h2>
              <p className="text-sm whitespace-pre-line text-ink">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
