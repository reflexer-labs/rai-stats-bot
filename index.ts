import Twit from "twit";
import Axios from "axios";

// Main
export const tweetUpdate = async () => {
  // Configure Twitter API
  const twit = new Twit({
    consumer_key: process.env.CONSUMER_KEY as string,
    consumer_secret: process.env.CONSUMER_SECRET as string,
    access_token: process.env.ACCESS_TOKEN as string,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET as string,
  });

  // Fetch RAI stats from subgraph
  const stats = await getSubgraphData();

  // Assemble Tweet
  // Spacing made to align the prices with Twitter font
  const tweetContent = `🗿 RAI update 🗿

Market Price: $${stats.marketPrice}
Oracle Price: $${stats.oraclePrice}
Redemption Price: $${stats.redemptionPrice}
Annualized Redemption Rate: ${stats.annualizedRate}%
`;

  // Post tweet
  const id = await tweet(tweetContent, twit);
  console.log(`Posted Tweet id: ${id}`);
};

// == Twitter endpoint functions ==

// Post a Tweet
const tweet = async (message: string, twit: Twit, mediaId?: string) => {
  const data = await twitterApiPost(
    "statuses/update",
    {
      status: message,
      media_ids: mediaId ? [mediaId] : undefined,
    },
    twit
  );
  return data.id_str as string;
};

// Generic Twitter API request
const twitterApiPost = async (path: string, params: Twit.Params, twit: Twit) =>
  new Promise<any>((resolve, reject) => {
    twit.post(path, params, (err, data, response) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Twitter API post ${path} success: ${response.statusCode}`);
        resolve(data);
      }
    });
  });

// == Subgraph ==

const getSubgraphData = async () => {
  const res = await subgraphQuery(
    "https://subgraph.reflexer.finance/subgraphs/name/reflexer-labs/rai",
    `
  {
    systemState(id: "current") {
      currentRedemptionPrice {
        value
      }
      currentRedemptionRate {
        annualizedRate
      }
      currentCoinMedianizerUpdate {
        value
      }
      
    }
      collateralType(id: "ETH-A") {
        currentPrice {
          value
        }
      }
      uniswapPair(id: "0x8ae720a71622e824f576b4a8c03031066548a3b1") {
        token1Price
      }
    }`
  );

  // Get ether price from CoinGecko
  const ethPrice = parseFloat(
    (
      await Axios.get(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      )
    ).data.ethereum.usd
  );

  // Parse and process data
  const redemptionPrice = parseFloat(
    res.systemState.currentRedemptionPrice.value
  );
  const annualizedRate =
    (parseFloat(res.systemState.currentRedemptionRate.annualizedRate) -
      1) *
    100;
  const uniswapPaiPrice = parseFloat(res.uniswapPair.token1Price);

  const oraclePrice = parseFloat(
    res.systemState.currentCoinMedianizerUpdate.value
  );

  return {
    marketPrice: (uniswapPaiPrice * ethPrice).toFixed(4),
    redemptionPrice: redemptionPrice.toFixed(4),
    annualizedRate: annualizedRate.toFixed(4),
    oraclePrice: oraclePrice.toFixed(4),
  };
};

const subgraphQuery = async (host: string, query: string) => {
  const resp = await Axios.post(host, {
    query,
  });

  if (!resp.data || !resp.data.data) {
    throw "No data";
  }

  return resp.data.data;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
