const request = require('request-promise');
const urlDIA = 'https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search?fq=alternateIds_Ean:%EAN%&_from=0&_to=3';

async function getProductoDeDia(ean) {
    const URL = urlDIA.replace('%EAN%', ean);
    return await request.get(URL, { json: true })
}

function getPrecio(productoDIA) {
    try {
        return productoDIA[0].items[0].sellers[0].commertialOffer.Price
    } catch (error) {
        return undefined;
    }
}

exports.getProducto = (ean) => {
    return getProductoDeDia(ean).then((prodDia) => {
        return getPrecio(prodDia);

    }).catch((err) => {
        console.log("Problemas llamando al servicio de DIA", err.message);
    });
}

exports.getName = () => 'Dia %';