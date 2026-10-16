/** A workflow status as readable text for messages, e.g. 'pending_approval' -> 'pending approval'. */
function presentableStatus(status) {
  return status.replaceAll('_', ' ');
}

module.exports = { presentableStatus };
