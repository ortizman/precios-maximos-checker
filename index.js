const request = require('request-promise');
const fs = require('fs');

const url = 'https://preciosmaximos.argentina.gob.ar/api/products?pag=1&Provincia=Buenos%20Aires&regs=';
const registros = 10;
const preciosMaximosFileName = '/productosPreciosMaximos.json';
const fechaUltimoGetFileName = '/timestampUltimoGet.txt';

const superdia = require('./dia');

let fechaUltimoGet;

try {
    fechaUltimoGet = fs.readFileSync(__dirname + fechaUltimoGetFileName, { encoding: 'utf-8' });
} catch (error) {
    console.warn('No exite el archivo ' + fechaUltimoGetFileName + '.');
    fechaUltimoGet = 0;
}

/**
 * @typedef {Object} ResultPreciosMax
 * @property {Array} result - listado de productos
 */
/**
 * Obtiene la lista de precios maximos
 * La lista se obtiene mantiene en cache durante 24hs
 * @returns {ResultPreciosMax}
 */
async function getProductosPreciosMaximos() {

    // si la fecha de ultimo get + 24hs es menos a la fecha actual
    // retorno el resultado guardado
    if (fechaUltimoGet + 86400000 > Date.now()) {
        console.log('Recupero los productos precios maximos desde el archivo en el FS');
        return JSON.parse(
            fs.readFileSync(__dirname + preciosMaximosFileName, { encoding: 'utf-8' })
        );
    }

    try {
        let response = await request.get(url + registros, { json: true });
        fs.writeFile(__dirname + preciosMaximosFileName, JSON.stringify(response), { encoding: 'utf-8' }, () => {
            console.log('Se guardo con exito el ultimo listado de precios maximos')
        });

        fechaUltimoGet = Date.now();
        fs.writeFileSync(__dirname + fechaUltimoGetFileName, fechaUltimoGet, { encoding: 'utf-8' }, () => {
            console.log('Se guardo con exito la fecha de ultimo get');

        });

        console.log('Obtengo por WS REst los precios maximos');

        return response;

    } catch (error) {
        console.error('Error obtienendo los productos de precios maximos', error);
        throw error;
    }
}

function chunkArray(array, chunk_size) {
    var results = [];

    while (array.length) {
        results.push(array.splice(0, chunk_size));
    }

    return results;
}

function collect(precio, prod, productosQueNoCumplen, productosQueNoEstan, productosQueCumplen) {
    const cumple = precio && parseInt(precio) <= parseInt(prod['Precio sugerido']);
    if (!cumple && precio !== undefined) {
        console.log("El producto ", prod.Producto, "No Cumple. \n Precio Maximo: ", prod['Precio sugerido'], "\nPrecio en DIA: ", precio);
        productosQueNoCumplen.push(prod);
    }
    else if (precio === undefined) {
        productosQueNoEstan.push(prod);
    }
    else {
        productosQueCumplen.push(prod);
    }
}

(async () => {
    let prodPrecMax = await getProductosPreciosMaximos();
    const totalProductosPreciosMax = prodPrecMax.result.length;

    if (prodPrecMax.result) {
        let productosQueNoCumplen = [];
        let productosQueCumplen = [];
        let productosQueNoEstan = [];

        let productosInChunk = chunkArray(prodPrecMax.result, 20);

        for (const chunk of productosInChunk) {
            let arrayPromise = [];
            for (const prod of chunk) {
                const ean = prod.id_producto;
                let promise = superdia.getProducto(ean).then((precio) => {
                    collect(precio, prod, productosQueNoCumplen, productosQueNoEstan, productosQueCumplen);
                }).catch((err) => {
                    console.log("Problemas llamando al servicio del Super DIA", err.message);
                });
                arrayPromise.push(promise)
            }

            await Promise.all(arrayPromise);
        }

        console.log("Cantidad de productos que no existen en DIA: ", productosQueNoEstan.length);
        console.log("Cantidad de productos que SI cumplen: ", productosQueCumplen.length);
        console.log("Cantidad de productos que NO cumplen: ", productosQueNoCumplen.length);
        console.dir("Productos que NO cumplen ", productosQueNoCumplen);

        console.log("Total productos en precios Maximos", totalProductosPreciosMax);

    }
})();

