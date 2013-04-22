exports.NAME = "anarch";
exports.MESSAGE_TYPE = {
	JSON: 0, // [0, message]
	REMOTE_ADDRESS: 1, // [1, address]
	REMOTE_ADDRESSES: 2, // [2, addresses]

	RTC_OFFER: 3, // [3, description, data]
	RTC_ANSWER: 4, // [4, description]
	RTC_ICE_CANDIDATE: 5, // [5, candidate]

	RELAY: 6, // [6, address, message]
	RELAYED: 7 // [7, address, message]
};
