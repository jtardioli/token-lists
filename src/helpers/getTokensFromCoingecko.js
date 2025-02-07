const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const axios = require("axios");
const listStaticConfigs = require("../assets/listStaticConfigs.json");
const coingeckoPlatformFromNetworkId = require("./coingeckoPlatformFromNetworkId");
const sleep = require("./sleep");
const uriSchema = require("../schemas/uriSchema");
const getCoingeckoCoinsList = require("./getCoingeckoCoinsList");
const getTokenDecimals = require("./getTokenDecimals");
const formatTokenAddress = require("./formatTokenAddress");

const uriValidate = addFormats(new Ajv()).compile(uriSchema);

module.exports = async function getTokensFromCoingecko(
  networkId,
  currentTokensMap
) {
  const coinsList = await getCoingeckoCoinsList();
  const tokensByAddress = new Map();
  const platform = coingeckoPlatformFromNetworkId(networkId);
  const chainId = listStaticConfigs[networkId]?.chainId;
  if (!chainId) throw new Error("List static config or chainId is missing");

  console.log("starting");
  for (let i = 0; i < coinsList.length; i++) {
    const coin = coinsList[i];
    console.log(coin);
    if (!coin.id || !coin.platforms || !coin.platforms[platform]) continue;
    let address;
    try {
      address = formatTokenAddress(coin.platforms[platform], networkId);
    } catch (error) {
      continue;
    }

    console.log(address);

    if (currentTokensMap.get(address) && Math.random() > 0.05) {
      tokensByAddress.set(address, currentTokensMap.get(address));
      continue;
    }
    if (tokensByAddress.get(address)) continue;
    const coinDetailsResponse = await axios
      .get(`https://api.coingecko.com/api/v3/coins/${coin.id}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: false,
          sparkline: false,
        },
      })
      .catch(() => null);
    console.log("before sleep");
    await sleep(5000);
    console.log("after  sleep");

    if (!coinDetailsResponse || !coinDetailsResponse.data) continue;
    const coinDetails = coinDetailsResponse.data;

    // Decimals
    let decimals =
      coinDetails.detail_platforms?.[platform].decimal_place || null;
    if (decimals === null) console.log("start get decimal");
    decimals = await getTokenDecimals(networkId, address);
    console.log("after get decimal");
    if (decimals === null) continue;

    const isUriValid = uriValidate(coinDetails.image.small);
    const logoURI = isUriValid ? coinDetails.image.small : undefined;
    const token = {
      chainId,
      address,
      decimals,
      name: coinDetails.name,
      symbol: coinDetails.symbol,
      logoURI,
      extensions: {
        coingeckoId: coinDetails.id,
      },
    };
    tokensByAddress.set(address, token);
  }
  // await sleep(30000);
  console.log("done");
  return Array.from(tokensByAddress.values());
};
