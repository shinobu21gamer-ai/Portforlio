const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
  };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

const sendPaginated = (res, data, pagination, message = 'Success') => {
  if (pagination === undefined && data && typeof data === 'object' && data.pagination) {
    const { pagination: p, ...rest } = data;
    return res.status(200).json({
      success: true,
      message,
      data: { ...rest, pagination: p },
    });
  }
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

const sendError = (res, statusCode = 500, message = 'Internal server error', errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors !== null) response.errors = errors;
  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendPaginated, sendError };
